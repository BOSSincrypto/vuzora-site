/**
 * Markdown mirrors of every public page.
 *
 * An agent that cannot read a page reaches for the same convention every time:
 * the page path, minus the trailing slash, plus `.md`. These builders produce
 * that file for each route from the same content the HTML renders, so the two
 * cannot state different prices, dates, or boundaries.
 *
 * Bodies are plain Markdown: no front matter, no HTML, no invented facts.
 * Internal links stay root-relative — the canonical URL is stated at the top of
 * every document, so `/unis/msu/` is unambiguous — and external destinations
 * stay absolute.
 *
 * @module scripts/markdown-mirrors
 */

import { MARKDOWN_MEDIA_TYPE, markdownMirrorPath } from "./markdown-artifacts.mjs";

const RICH_TEXT_LINK_RE = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

/** `[[href|label]]` → `[label](href)`. Same markup `src/lib/rich-text.tsx` renders. */
export function richTextToMarkdown(text) {
  return text.replace(RICH_TEXT_LINK_RE, (_match, href, label) => `[${label}](${href})`);
}

/** Public path → repo-relative artifact path (`/unis/msu/` → `unis/msu.md`). */
function artifactPath(pagePath) {
  return markdownMirrorPath(pagePath).replace(/^\/+/, "");
}

/** Drop blank sections and join with exactly one blank line between blocks. */
function document(blocks) {
  return `${blocks.filter((block) => block && block.trim()).join("\n\n")}\n`;
}

function section(blocks) {
  return document(blocks).trimEnd();
}

function bulletList(items) {
  return items.map((item) => `- ${richTextToMarkdown(item)}`).join("\n");
}

function faqSection(entries, heading = "Частые вопросы") {
  if (!entries.length) return "";
  const body = entries
    .map((entry) => `### ${entry.question}\n\n${richTextToMarkdown(entry.answer)}`)
    .join("\n\n");
  return `## ${heading}\n\n${body}`;
}

/**
 * Header every mirror opens with: identity, the canonical address, and what
 * this file is. A mirror read on its own must still say what it mirrors.
 */
function header(snapshot, { identity, pagePath, lede }) {
  const canonical = `${snapshot.site.url}${pagePath}`;
  return section([
    `# ${identity}`,
    lede ? `> ${lede}` : "",
    `Markdown-версия страницы ${canonical} — тот же материал, что на сайте.`,
  ]);
}

function legalMirror(snapshot, legal) {
  const sections = legal.sections.map((entry) =>
    section([
      `## ${entry.title}`,
      ...entry.blocks.map((block) =>
        block.kind === "p" ? richTextToMarkdown(block.text) : bulletList(block.items),
      ),
    ]),
  );
  return document([
    header(snapshot, {
      identity: legal.heading,
      pagePath: legal.path,
      lede: legal.description,
    }),
    `Редакция от ${legal.revision}.`,
    ...sections,
  ]);
}

function universityMirror(snapshot, university) {
  const official = [
    university.officialUrl ? `- Сайт вуза: ${university.officialUrl}` : "",
    university.scheduleUrl
      ? `- Официальное расписание занятий: ${university.scheduleUrl}`
      : "- Официальное расписание: единой страницы нет, его публикуют факультеты.",
  ].filter(Boolean);

  return document([
    header(snapshot, {
      identity: university.title,
      pagePath: university.path,
      lede: university.lead,
    }),
    section([
      "## Запись реестра",
      bulletList([
        `Название: ${university.name}`,
        `Код: ${university.code}`,
        `Город: ${university.city}`,
        `Статус подключения: ${university.statusLabel}`,
      ]),
    ]),
    section(["## Что делает Vuzora для этого вуза", university.copy]),
    section(["## Официальные источники", official.join("\n")]),
    faqSection(university.faq),
    section([
      "## Подключение",
      bulletList([
        `Ссылка с привязкой к вузу: ${university.botUrl}`,
        "Каталог поддерживаемых вузов: /unis/",
        "Тарифы: /pricing/",
      ]),
    ]),
  ]);
}

function postMirror(snapshot, post) {
  const related = post.universitySlug
    ? snapshot.universities.find((university) => university.slug === post.universitySlug)
    : null;
  return document([
    header(snapshot, { identity: post.title, pagePath: post.path, lede: post.summary }),
    `Опубликовано: ${post.date} (${post.dateLabel}). Чтение: ${post.readingTime}.`,
    related
      ? `Основная страница по этому вузу — ${related.name}: ${related.path}. ` +
        "Заметка её дополняет, а не заменяет."
      : "",
    post.body.map((paragraph) => richTextToMarkdown(paragraph)).join("\n\n"),
    section([
      "## Дальше",
      bulletList([`Все заметки: ${snapshot.blogIndexPath}`, `Бот: ${snapshot.site.links.botUrl}`]),
    ]),
  ]);
}

function blogIndexMirror(snapshot) {
  const rows = snapshot.posts
    .map(
      (post) =>
        `- **${post.title}** — ${post.date}, ${post.readingTime} — ${post.path}\n` +
        `  ${post.summary}`,
    )
    .join("\n");
  return document([
    header(snapshot, {
      identity: "Блог Vuzora",
      pagePath: snapshot.blogIndexPath,
      lede: "Заметки про утренний ритуал, разбор расписаний и устройство Vuzora.",
    }),
    section([`## Записи (${snapshot.posts.length})`, rows]),
    "Лента: /blog/rss.xml",
  ]);
}

function changelogMirror(snapshot) {
  const entries = snapshot.changelog
    .map((entry) =>
      section([
        `### ${entry.date} — ${entry.title}`,
        `Раздел: ${entry.tag}. Дата: ${entry.dateLabel}.`,
        bulletList(entry.bullets),
      ]),
    )
    .join("\n\n");
  return document([
    header(snapshot, {
      identity: "Что нового в Vuzora",
      pagePath: "/changelog/",
      lede: "Публичная история изменений: что появилось в боте, на сайте и в подписке.",
    }),
    section([`## Записи (${snapshot.changelog.length})`, entries]),
  ]);
}

function pricingMirror(snapshot) {
  const { pricing } = snapshot;
  const table = [
    "| Срок подписки | Цена, ₽ | Кому подходит |",
    "| --- | --- | --- |",
    ...pricing.plans.map((plan) => `| ${plan.period} | ${plan.priceLabel} | ${plan.hint} |`),
  ].join("\n");
  const timeline = pricing.timeline
    .map((entry) => `- **${entry.date} — ${entry.label}.** ${entry.body}`)
    .join("\n");

  return document([
    header(snapshot, {
      identity: "Тарифы Vuzora",
      pagePath: "/pricing/",
      lede: pricing.facts[0],
    }),
    section(["## Тарифы", table]),
    section(["## Что входит в любой тариф", bulletList(pricing.included)]),
    section(["## Даты запуска", timeline]),
    section(["## Оплата и возврат", pricing.carryOver, pricing.refund]),
    "Полные условия — публичная оферта: /legal/terms/",
  ]);
}

/**
 * The university catalogue.
 *
 * `assertUnisMarkdownRegistryJoin` reads this file and requires every registry
 * slug exactly once as `(/unis/<slug>/)`, with the code, name, and city on the
 * same line. Keep the row shape when editing.
 */
function universitiesMirror(snapshot) {
  const rows = snapshot.universities
    .map(
      (university) =>
        `- **${university.code}** — ${university.name}, ${university.city} — ` +
        `[страница](${university.path})`,
    )
    .join("\n");
  return document([
    header(snapshot, {
      identity: "Поддерживаемые вузы – Vuzora",
      pagePath: "/unis/",
      lede:
        `Vuzora поддерживает ${snapshot.universities.length} вузов. ` +
        "Каталог перечисляет опубликованные страницы вузов и не является расписанием.",
    }),
    section([`## Каталог (${snapshot.universities.length})`, rows]),
    `${snapshot.affiliationBoundary}. За подтверждением занятий и документов обращайся к вузу.`,
  ]);
}

function landingMirror(snapshot) {
  const { site, pricing } = snapshot;
  return document([
    header(snapshot, {
      identity: `${site.name} — расписание вуза в Telegram каждое утро`,
      pagePath: "/",
      lede: site.tagline,
    }),
    section([
      "## Коротко",
      bulletList([
        `Продукт: Telegram-бот ${site.links.botHandle}, который присылает расписание вуза утром.`,
        "Слот доставки: с 05:00 до 10:00 МСК, время выбирает пользователь.",
        `Поддерживаемых вузов: ${snapshot.universities.length} — каталог /unis/`,
        `Подписка: ${pricing.facts[0]}`,
        `${snapshot.affiliationBoundary}.`,
      ]),
    ]),
    faqSection(snapshot.faq),
    section([
      "## Страницы сайта",
      bulletList([
        "Тарифы: /pricing/",
        "Поддерживаемые вузы: /unis/",
        "Блог: /blog/",
        "Что нового: /changelog/",
        "Публичная оферта: /legal/terms/",
        "Политика конфиденциальности: /legal/privacy/",
      ]),
    ]),
  ]);
}

/**
 * Build every mirror as `{ path, route, identity, mediaType, body }`.
 *
 * `path` is relative to `public/`; `route` is the page the mirror represents.
 * Sorted by path so the release manifest is stable across builds.
 *
 * @param {ReturnType<import("./content-snapshot.mjs").readContentSnapshot>} snapshot
 */
export function buildMarkdownMirrors(snapshot) {
  const mirrors = [
    { pagePath: "/", body: landingMirror(snapshot) },
    { pagePath: "/pricing/", body: pricingMirror(snapshot) },
    { pagePath: "/unis/", body: universitiesMirror(snapshot) },
    { pagePath: "/changelog/", body: changelogMirror(snapshot) },
    { pagePath: snapshot.blogIndexPath, body: blogIndexMirror(snapshot) },
    ...snapshot.posts.map((post) => ({ pagePath: post.path, body: postMirror(snapshot, post) })),
    ...snapshot.universities.map((university) => ({
      pagePath: university.path,
      body: universityMirror(snapshot, university),
    })),
    ...snapshot.legal.map((legal) => ({
      pagePath: legal.path,
      body: legalMirror(snapshot, legal),
    })),
  ];

  return mirrors
    .map(({ pagePath, body }) => ({
      path: artifactPath(pagePath),
      route: pagePath,
      identity: body.match(/^#\s+(.+?)\s*$/m)?.[1] ?? "",
      mediaType: MARKDOWN_MEDIA_TYPE,
      body,
    }))
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

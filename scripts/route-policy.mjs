import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MARKDOWN_ARTIFACTS } from "./markdown-artifacts.mjs";

const read = (path, root = process.cwd()) => readFile(join(root, path), "utf8");
const field = (record, name) => {
  const match = record.match(new RegExp(`\\b${name}\\s*:\\s*["']([^"']*)["']`));
  return match?.[1];
};

/** Extract the required affiliation-boundary wording from universities helpers. */
export function readAffiliationBoundary(universitiesSource) {
  const match = universitiesSource.match(
    /export const AFFILIATION_BOUNDARY\s*=\s*\n?\s*["']([^"']+)["']/,
  );
  if (!match?.[1]) throw new Error("Could not locate AFFILIATION_BOUNDARY export");
  return match[1];
}

export async function readRegistry(root = process.cwd()) {
  const [universitiesSource, blogSource] = await Promise.all([
    read("src/content/universities.ts", root),
    read("src/content/blog.ts", root),
  ]);
  const registryBlock = universitiesSource.match(
    /export const UNIVERSITIES[\s\S]*?=\s*\[[\s\S]*?\]\s*as const/,
  )?.[0];
  if (!registryBlock) throw new Error("Could not locate UNIVERSITIES registry");

  const universities = [...registryBlock.matchAll(/\{([^{}]*)\}/g)].map((match) => {
    const record = match[1];
    return {
      slug: field(record, "slug") ?? null,
      code: field(record, "code") ?? null,
      name: field(record, "name") ?? null,
      city: field(record, "city") ?? null,
      status: field(record, "status") ?? null,
      officialUrl: field(record, "officialUrl") ?? null,
    };
  });
  const postRecords = [...blogSource.matchAll(/\{([\s\S]*?)\n\s*\},?/g)]
    .map((match) => match[1])
    .map((record) => ({
      slug: field(record, "slug"),
      title: field(record, "title"),
      date: field(record, "date"),
      summary: field(record, "summary"),
      universitySlug: field(record, "universitySlug") ?? null,
    }))
    .filter((record) => record.slug && record.title);
  const posts = postRecords.map((record) => record.slug);
  const focusedPosts = postRecords.filter((record) => record.universitySlug);
  const affiliationBoundary = readAffiliationBoundary(universitiesSource);

  return { universities, posts, postRecords, focusedPosts, affiliationBoundary };
}

export function buildRoutes({ universities, posts }) {
  const core = ["/", "/pricing", "/unis", "/blog/", "/changelog", "/legal/terms", "/legal/privacy"];
  const blog = posts.map((slug) => `/blog/${slug}`);
  const university = universities
    .filter((record) => record.slug)
    .map((record) => `/unis/${record.slug}`);
  return [...core, ...blog, ...university];
}

export function artifactFor(route) {
  if (route === "/") return "index.html";
  if (route === "/blog/rss.xml") return "blog/rss.xml";
  return `${route.replace(/\/$/, "")}/index.html`.replace(/^\//, "");
}

const CORE_ROUTE_EXPECTATIONS = {
  "/": {
    title: "Vuzora – расписание вуза в Telegram каждое утро",
    description:
      "Telegram-бот сам присылает расписание твоего вуза каждое утро в удобный тебе слот с 05:00 до 10:00 МСК. Без поиска, без рекламы, без шума.",
    heading: "Расписание твоего вуза. Каждое утро.",
    internalLinks: ["/pricing", "/unis", "/blog/", "/changelog", "/legal/terms", "/legal/privacy"],
    jsonLdTypes: ["SoftwareApplication", "FAQPage"],
    jsonLdIdentity: [
      { type: "SoftwareApplication", name: "Vuzora", url: "https://t.me/vuzora_bot" },
    ],
    ctas: [
      { marker: "generic-conversion", href: "https://t.me/vuzora_bot?start=from-site", count: 4 },
      { marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 4 },
      { marker: "support", href: "https://t.me/vuzora_support_bot", count: 1 },
    ],
  },
  "/pricing": {
    title: "Тарифы Vuzora – подписка от 49 ₽",
    description:
      "Цена подписки на Vuzora: от 49 ₽ за месяц до 599 ₽ за весь срок обучения. Без рекламы и автопродления.",
    heading: "Тарифы и подписка Vuzora",
    internalLinks: ["/pricing", "/unis", "/blog/"],
    jsonLdTypes: ["Product", "BreadcrumbList"],
    jsonLdIdentity: [{ type: "Product", name: "Vuzora — подписка" }],
    ctas: [
      { marker: "generic-conversion", href: "https://t.me/vuzora_bot?start=from-site", count: 1 },
      { marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 4 },
    ],
  },
  "/unis": {
    title: "Поддерживаемые вузы – Vuzora",
    description:
      "Список вузов, для которых Vuzora уже умеет присылать расписание. Нет твоего вуза – напиши, добавим.",
    heading: "Поддерживаемые вузы",
    internalLinks: ["/unis", "/pricing", "/blog/"],
    jsonLdTypes: ["ItemList", "BreadcrumbList"],
    jsonLdIdentity: [
      {
        type: "ItemList",
        "@id": "https://vuzora.ru/unis#directory",
        name: "Поддерживаемые вузы – Vuzora",
        url: "https://vuzora.ru/unis",
      },
    ],
    ctas: [
      { marker: "support", href: "https://t.me/vuzora_support_bot", count: 1 },
      { marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 4 },
    ],
  },
  "/blog/": {
    title: "Блог – Vuzora",
    description:
      "Заметки про утренний ритуал, парсинг расписаний и устройство Vuzora. Без воды и SEO-выжимок.",
    heading: "Блог Vuzora",
    internalLinks: ["/blog/", "/pricing", "/unis", "/changelog", "/legal/terms", "/legal/privacy"],
    jsonLdTypes: ["Blog", "BreadcrumbList"],
    jsonLdIdentity: [
      {
        type: "Blog",
        "@id": "https://vuzora.ru/blog/#blog",
        name: "Блог – Vuzora",
        url: "https://vuzora.ru/blog/",
      },
      {
        type: "BreadcrumbList",
        "@id": "https://vuzora.ru/blog/#breadcrumb",
        name: "Блог – Vuzora",
        url: "https://vuzora.ru/blog/",
      },
    ],
    ctas: [{ marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 4 }],
  },
  "/changelog": {
    title: "Что нового – Vuzora",
    description:
      "Публичная история изменений Vuzora: что добавили в бот, на сайт и в подписку.",
    heading: "Что нового",
    internalLinks: ["/changelog", "/pricing", "/unis", "/blog/", "/legal/terms", "/legal/privacy"],
    jsonLdTypes: ["BreadcrumbList"],
    jsonLdIdentity: [
      {
        type: "BreadcrumbList",
        "@id": "https://vuzora.ru/changelog#breadcrumb",
        name: "Что нового – Vuzora",
        url: "https://vuzora.ru/changelog",
      },
    ],
    ctas: [{ marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 4 }],
  },
  "/legal/terms": {
    title: "Публичная оферта – Vuzora",
    description:
      "Условия оказания услуг сервиса Vuzora: подписка, оплата, возврат средств и ответственность сторон.",
    heading: "Публичная оферта",
    internalLinks: ["/", "/pricing"],
    jsonLdTypes: ["BreadcrumbList"],
    jsonLdIdentity: [
      {
        type: "BreadcrumbList",
        "@id": "https://vuzora.ru/legal/terms#breadcrumb",
        name: "Публичная оферта – Vuzora",
        url: "https://vuzora.ru/legal/terms",
      },
    ],
    ctas: [
      { marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 1 },
      { marker: "support", href: "https://t.me/vuzora_support_bot", count: 1 },
    ],
  },
  "/legal/privacy": {
    title: "Политика конфиденциальности – Vuzora",
    description:
      "Какие персональные данные собирает Vuzora, как они хранятся и как пользователь может их удалить.",
    heading: "Политика конфиденциальности",
    internalLinks: ["/"],
    jsonLdTypes: ["BreadcrumbList"],
    jsonLdIdentity: [
      {
        type: "BreadcrumbList",
        "@id": "https://vuzora.ru/legal/privacy#breadcrumb",
        name: "Политика конфиденциальности – Vuzora",
        url: "https://vuzora.ru/legal/privacy",
      },
    ],
    ctas: [{ marker: "support", href: "https://t.me/vuzora_support_bot", count: 1 }],
  },
};

export function routeExpectationFor(route, { postRecords = [], universities = [] } = {}) {
  if (CORE_ROUTE_EXPECTATIONS[route]) return CORE_ROUTE_EXPECTATIONS[route];
  if (route.startsWith("/unis/")) {
    const slug = route.slice("/unis/".length);
    const university = universities.find((record) => record.slug === slug);
    if (university) {
      return {
        heading: university.name,
        internalLinks: ["/unis"],
        jsonLdTypes: ["BreadcrumbList", "CollegeOrUniversity", "Service", "FAQPage"],
        jsonLdIdentity: [
          {
            type: "CollegeOrUniversity",
            "@id": `https://vuzora.ru${route}#university`,
            name: university.name,
            url: `https://vuzora.ru${route}`,
          },
          {
            type: "Service",
            "@id": "https://vuzora.ru/#service",
            about: `https://vuzora.ru${route}#university`,
          },
        ],
        ctas: [
          {
            marker: "university-conversion",
            href: `https://t.me/vuzora_bot?start=from-site_${university.slug}`,
            count: 1,
          },
          { marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 4 },
        ],
      };
    }
  }
  if (route.startsWith("/blog/")) {
    const slug = route.slice("/blog/".length);
    const post = postRecords.find((record) => record.slug === slug);
    if (post) {
      return {
        title: `${post.title} – Vuzora`,
        description: post.summary,
        heading: post.title,
        internalLinks: [
          "/blog/",
          "/pricing",
          "/unis",
          "/changelog",
          "/legal/terms",
          "/legal/privacy",
        ],
        jsonLdTypes: ["BlogPosting", "BreadcrumbList"],
        jsonLdIdentity: [
          {
            type: "BlogPosting",
            "@id": `https://vuzora.ru${route}#post`,
            mainEntityOfPage: `https://vuzora.ru${route}`,
            url: `https://vuzora.ru${route}`,
          },
        ],
        ctas: [
          {
            marker: "generic-conversion",
            href: "https://t.me/vuzora_bot?start=from-site",
            count: 1,
          },
          { marker: "bot-navigation", href: "https://t.me/vuzora_bot", count: 4 },
        ],
      };
    }
  }
  return undefined;
}

export function manifestFor({ universities, posts }) {
  return {
    universities: universities.map((record) => ({ ...record })),
    posts: [...posts],
    markdown: MARKDOWN_ARTIFACTS.map((entry) => ({ ...entry })),
  };
}

/**
 * Registry-driven AI discovery packet (`llms.txt`) helpers.
 *
 * Single source for generation + fail-closed join checks so public/llms.txt
 * cannot drift from `src/content/universities.ts`.
 */

export const CANONICAL_ORIGIN = "https://vuzora.ru";
export const BOT_URL = "https://t.me/vuzora_bot";
export const GENERIC_START = "from-site";
export const DETAIL_URL_RE =
  /https:\/\/vuzora\.ru\/unis\/([a-z0-9-]+)(?=$|[\s)\]}>.,;:`])/g;
const NON_CANONICAL_DETAIL_URL_RE =
  /https:\/\/vuzora\.ru\/unis\/([a-z0-9-]+)(?:[/?#][^\s<>"'`]*)/g;

/** Loose secret / credential patterns that must never appear in public AEO text. */
export const SECRET_PATTERN_RE =
  /\b(?:api[_-]?key|cloudflare|cf[-_]?api(?:[_-]?token)?|sk_live|sk_test|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-|Bearer\s+[A-Za-z0-9\-._~+/]+=*|DATABASE_URL|postgres(?:ql)?:\/\/\S+:\S+@|mongodb(?:\+srv)?:\/\/\S+:\S+@|AKIA[0-9A-Z]{16})\b/i;

export const OFFICIAL_PARTNER_RE =
  /официальн(?:ый|ого|ым)?\s+партн[её]р|official\s+partner|официальн(?:ый|ое)\s+расписание\s+вуза/i;

/**
 * Absolute production detail URL for a registry slug.
 * @param {string} slug
 */
export function detailUrl(slug) {
  return `${CANONICAL_ORIGIN}/unis/${slug}`;
}

/**
 * Extract absolute university detail URLs from an AI packet body.
 * @param {string} body
 * @returns {{ url: string, slug: string }[]}
 */
export function extractDetailUrls(body) {
  const found = [];
  for (const match of body.matchAll(DETAIL_URL_RE)) {
    found.push({ url: match[0], slug: match[1] });
  }
  return found;
}

function extractDetailRows(body) {
  const rows = [];
  for (const match of body.matchAll(DETAIL_URL_RE)) {
    const lineStart = body.lastIndexOf("\n", match.index) + 1;
    const lineEnd = body.indexOf("\n", match.index);
    rows.push({
      url: match[0],
      slug: match[1],
      row: body.slice(lineStart, lineEnd === -1 ? body.length : lineEnd),
    });
  }
  return rows;
}

/**
 * Build the committed `llms.txt` body from the university registry.
 * @param {Array<{ slug: string|null, code: string|null, name: string|null }>} universities
 * @param {{ affiliationBoundary?: string }} [options]
 */
export function buildLlmsPacket(universities, options = {}) {
  const affiliationBoundary =
    options.affiliationBoundary ?? "Сервис не является официальным сервисом вуза";
  const rows = universities.filter((university) => university?.slug);
  const list = rows
    .map((university) => {
      const code = university.code ?? "";
      const name = university.name ?? university.slug;
      const identity = code ? `${name} (${code})` : name;
      return `- ${identity}: ${detailUrl(university.slug)}`;
    })
    .join("\n");

  return (
    `# Vuzora\n` +
    `\n` +
    `> Vuzora — неофициальный Telegram-бот, который каждое утро присылает студенту ` +
    `расписание его вуза в удобный слот с 05:00 до 10:00 МСК. Не справочник, где надо искать — ` +
    `а тихий утренний ритуал доставки. Без рекламы, без шума. ${affiliationBoundary}.\n` +
    `\n` +
    `## Продукт\n` +
    `\n` +
    `- Продукт: Vuzora — расписание вуза в Telegram каждое утро.\n` +
    `- Бот: ${BOT_URL}\n` +
    `- Атрибуция CTA (start-параметр):\n` +
    `  - общий переход с сайта: \`?start=${GENERIC_START}\` → ${BOT_URL}?start=${GENERIC_START}\n` +
    `  - переход со страницы вуза: \`?start=${GENERIC_START}_<slug>\` → ${BOT_URL}?start=${GENERIC_START}_<slug>\n` +
    `  - пример: ${BOT_URL}?start=${GENERIC_START}_msu\n` +
    `- ${affiliationBoundary}. Это неофициальный сервис; Vuzora не является официальным сервисом вузов и не публикует выдуманные полные расписания на сайте.\n` +
    `\n` +
    `## Поддерживаемые вузы (${rows.length})\n` +
    `\n` +
    `Каждая запись — страница вуза на vuzora.ru (абсолютный URL) с кодом/названием из реестра.\n` +
    `\n` +
    `${list}\n` +
    `\n` +
    `## Страницы сайта\n` +
    `\n` +
    `- [Главная](${CANONICAL_ORIGIN}/): что такое Vuzora, как работает, для каких вузов.\n` +
    `- [Тарифы](${CANONICAL_ORIGIN}/pricing): цены подписки.\n` +
    `- [Поддерживаемые вузы](${CANONICAL_ORIGIN}/unis): каталог вузов.\n` +
    `- [Блог](${CANONICAL_ORIGIN}/blog/): материалы о расписании в Telegram.\n` +
    `- [Пользовательское соглашение](${CANONICAL_ORIGIN}/legal/terms).\n` +
    `- [Политика конфиденциальности](${CANONICAL_ORIGIN}/legal/privacy).\n`
  );
}

/**
 * Fail closed unless the packet is a bijective join to the registry with identity,
 * product positioning, CTA docs, and honesty constraints.
 * @param {string} body
 * @param {Array<{ slug: string|null, code: string|null, name: string|null }>} universities
 * @param {{ affiliationBoundary?: string }} [options]
 */
export function assertLlmsJoin(body, universities, options = {}) {
  if (typeof body !== "string" || !body.trim()) {
    throw new Error("llms.txt is empty or missing");
  }

  const registry = universities.filter((university) => university?.slug);
  const expectedSlugs = registry.map((university) => university.slug);
  const expectedSet = new Set(expectedSlugs);
  const nonCanonical = [...body.matchAll(NON_CANONICAL_DETAIL_URL_RE)].map((match) => match[0]);
  if (nonCanonical.length) {
    throw new Error(
      `llms.txt contains non-canonical university detail URL(s): ${nonCanonical.join(", ")}`,
    );
  }
  const rows = extractDetailRows(body);
  const found = rows.map(({ url, slug }) => ({ url, slug }));
  const foundSlugs = found.map((entry) => entry.slug);
  const foundSet = new Set(foundSlugs);

  const missing = expectedSlugs.filter((slug) => !foundSet.has(slug));
  if (missing.length) {
    throw new Error(
      `llms.txt underlist: missing ${missing.length} registry detail URL(s): ${missing.join(", ")}`,
    );
  }

  const phantom = foundSlugs.filter((slug) => !expectedSet.has(slug));
  if (phantom.length) {
    throw new Error(
      `llms.txt overlist: phantom slug(s) not in registry: ${[...new Set(phantom)].join(", ")}`,
    );
  }

  if (foundSlugs.length !== expectedSlugs.length) {
    // Duplicates or multiset mismatch after set equality on membership.
    const counts = new Map();
    for (const slug of foundSlugs) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);
    if (duplicates.length) {
      throw new Error(`llms.txt bijective join failed: duplicate detail URL(s): ${duplicates.join(", ")}`);
    }
    throw new Error(
      `llms.txt join count mismatch: expected ${expectedSlugs.length} absolute detail URLs, found ${foundSlugs.length}`,
    );
  }

  // Relative-only university detail paths are not acceptable as the sole listing form.
  // Absolute join already required; still reject relative-only entries used as primary list bullets.
  const relativeOnly = [
    ...body.matchAll(/(?:^|\s)(\/unis\/[a-z0-9-]+)(?![a-z0-9-])/gm),
  ].map((match) => match[1]);
  for (const path of relativeOnly) {
    const slug = path.slice("/unis/".length);
    if (expectedSet.has(slug) && !body.includes(detailUrl(slug))) {
      throw new Error(`llms.txt lists relative-only detail path without absolute URL: ${path}`);
    }
  }

  for (const row of rows) {
    const university = registry.find((candidate) => candidate.slug === row.slug);
    if (!university) continue;
    const hasName = university.name && row.row.includes(university.name);
    const hasCode = university.code && row.row.includes(university.code);
    if (!hasName && !hasCode) {
      throw new Error(
        `llms.txt row identity mismatch for slug ${university.slug}: need its name and/or code on the URL row`,
      );
    }
  }

  if (!/Vuzora/i.test(body)) throw new Error("llms.txt missing product name Vuzora");
  if (!/Telegram/i.test(body)) throw new Error("llms.txt missing Telegram product positioning");
  if (!/расписан/i.test(body)) throw new Error("llms.txt missing Russian schedule positioning");
  if (!/утр/i.test(body)) throw new Error("llms.txt missing morning-delivery product positioning");

  if (!body.includes(BOT_URL)) throw new Error("llms.txt must document the public bot URL");
  if (!body.includes(GENERIC_START)) throw new Error("llms.txt must document generic from-site attribution");
  if (!body.includes(`${GENERIC_START}_`)) {
    throw new Error("llms.txt must document university-scoped from-site_<slug> attribution");
  }

  const affiliationBoundary =
    options.affiliationBoundary ?? "Сервис не является официальным сервисом вуза";
  const hasDisclaimer =
    body.includes(affiliationBoundary) ||
    /неофициальн/i.test(body) ||
    /не является официальным сервисом/i.test(body);
  if (!hasDisclaimer) {
    throw new Error("llms.txt missing non-official / affiliation-boundary disclaimer");
  }
  if (OFFICIAL_PARTNER_RE.test(body)) {
    throw new Error("llms.txt claims official partnership or official university schedule status");
  }

  if (SECRET_PATTERN_RE.test(body)) {
    throw new Error("llms.txt contains secret-like credential patterns");
  }

  return {
    expectedCount: expectedSlugs.length,
    foundCount: foundSlugs.length,
    slugs: expectedSlugs,
  };
}

/**
 * True when a robots.txt Disallow rule blocks the given path under User-agent: *.
 * Uses robots-style path-prefix matching against Disallow values.
 * @param {string} robots
 * @param {string} path absolute path beginning with /
 */
export function robotsDisallowsPath(robots, path) {
  /** @type {{ agents: string[], disallows: string[] }[]} */
  const groups = [];
  /** @type {string[] | null} */
  let agents = null;
  /** @type {string[]} */
  let disallows = [];
  let sawRule = false;

  const pushGroup = () => {
    if (agents?.length) groups.push({ agents: [...agents], disallows: [...disallows] });
    agents = null;
    disallows = [];
    sawRule = false;
  };

  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const ua = line.match(/^User-agent:\s*(.+)$/i);
    if (ua) {
      if (sawRule) pushGroup();
      if (!agents) agents = [];
      agents.push(ua[1].trim());
      continue;
    }
    const disallow = line.match(/^Disallow:\s*(.*)$/i);
    if (disallow) {
      if (!agents) agents = ["*"];
      disallows.push(disallow[1].trim());
      sawRule = true;
      continue;
    }
    if (/^Allow:\s*/i.test(line)) {
      if (!agents) agents = ["*"];
      sawRule = true;
      continue;
    }
    if (/^Sitemap:/i.test(line)) {
      pushGroup();
    }
  }
  pushGroup();

  const starGroups = groups.filter((group) => group.agents.includes("*"));
  const rules =
    starGroups.length > 0
      ? starGroups.flatMap((group) => group.disallows)
      : [...robots.matchAll(/^Disallow:\s*(.*)$/gim)].map((match) => match[1].trim());

  for (const rule of rules) {
    if (rule === "") continue; // empty Disallow means allow all for that line
    if (path === rule || path.startsWith(rule)) return true;
  }
  return false;
}

/**
 * Assert robots does not block the AI packet path.
 * @param {string} robots
 * @param {string} [path]
 */
export function assertRobotsAllowsLlms(robots, path = "/llms.txt") {
  if (typeof robots !== "string" || !robots.trim()) {
    throw new Error("robots.txt is empty or missing");
  }
  if (robotsDisallowsPath(robots, path)) {
    throw new Error(`robots.txt Disallow blocks AI packet path ${path}`);
  }
  if (!/^User-agent:\s*\*/im.test(robots)) {
    throw new Error("robots.txt must declare a User-agent: * rule");
  }
}

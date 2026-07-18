/**
 * Registry-driven AI discovery packet (`llms.txt`) helpers.
 *
 * Single source for generation + fail-closed join checks so public/llms.txt
 * cannot drift from `src/content/universities.ts`.
 */

export const CANONICAL_ORIGIN = "https://vuzora.ru";
export const BOT_URL = "https://t.me/vuzora_bot";
export const GENERIC_START = "from-site";
export const NAMED_AI_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "ChatGPT-User",
  "Google-Extended",
  "Meta-ExternalAgent",
  "Gemini",
];
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
  for (const row of body.split(/\r?\n/)) {
    const matches = [...row.matchAll(DETAIL_URL_RE)];
    if (matches.length > 1) {
      throw new Error(
        `llms.txt university row must contain exactly one canonical detail URL; found ${matches.length}`,
      );
    }
    if (matches.length === 0) continue;
    const [match] = matches;
    rows.push({
      url: match[0],
      slug: match[1],
      row,
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
 * Parse robots.txt groups and their ordered Allow/Disallow rules.
 * @param {string} robots
 * @returns {{ agents: string[], rules: { type: "allow" | "disallow", path: string }[] }[]}
 */
export function parseRobotsGroups(robots) {
  /** @type {{ agents: string[], rules: { type: "allow" | "disallow", path: string }[] }[]} */
  const groups = [];
  /** @type {{ agents: string[], rules: { type: "allow" | "disallow", path: string }[] } | null} */
  let current = null;

  const pushGroup = () => {
    if (current?.agents.length) groups.push(current);
    current = null;
  };

  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const ua = line.match(/^User-agent:\s*(.+)$/i);
    if (ua) {
      if (current?.rules.length) pushGroup();
      if (!current) current = { agents: [], rules: [] };
      current.agents.push(ua[1].trim());
      continue;
    }
    const rule = line.match(/^(Allow|Disallow):\s*(.*)$/i);
    if (rule) {
      if (!current) current = { agents: ["*"], rules: [] };
      current.rules.push({
        type: rule[1].toLowerCase(),
        path: rule[2].trim(),
      });
    } else if (/^Sitemap:/i.test(line)) {
      pushGroup();
    }
  }
  pushGroup();
  return groups;
}

function matchingRobotsGroups(groups, userAgent) {
  const normalizedAgent = userAgent.trim().toLowerCase();
  const specific = groups.filter((group) =>
    group.agents.some((agent) => agent.toLowerCase() === normalizedAgent),
  );
  if (specific.length) return specific;
  return groups.filter((group) => group.agents.some((agent) => agent === "*"));
}

function pathRuleMatches(rule, path) {
  if (!rule) return false;
  if (rule.endsWith("$")) return path === rule.slice(0, -1);
  return path.startsWith(rule);
}

/**
 * Resolve a robots path using the longest matching rule, with Allow winning ties.
 * @param {string} robots
 * @param {string} path absolute path beginning with /
 * @param {string} [userAgent]
 */
export function robotsAllowsPath(robots, path, userAgent = "*") {
  const groups = parseRobotsGroups(robots);
  const rules = matchingRobotsGroups(groups, userAgent).flatMap((group) => group.rules);
  const matching = rules.filter((rule) => pathRuleMatches(rule.path, path));
  if (!matching.length) return true;
  const longest = Math.max(...matching.map((rule) => rule.path.length));
  return matching
    .filter((rule) => rule.path.length === longest)
    .some((rule) => rule.type === "allow");
}

/**
 * True when a robots.txt rule blocks the given path for the requested user agent.
 * @param {string} robots
 * @param {string} path absolute path beginning with /
 * @param {string} [userAgent]
 */
export function robotsDisallowsPath(robots, path, userAgent = "*") {
  return !robotsAllowsPath(robots, path, userAgent);
}

/**
 * Assert the named crawler policy and public AEO path decisions.
 * @param {string} robots
 */
export function assertRobotsPolicy(robots) {
  if (typeof robots !== "string" || !robots.trim()) {
    throw new Error("robots.txt is empty or missing");
  }
  const groups = parseRobotsGroups(robots);
  const namedAgents = NAMED_AI_CRAWLERS.filter((agent) =>
    groups.some((group) =>
      group.agents.some((candidate) => candidate.toLowerCase() === agent.toLowerCase()),
    ),
  );
  const missing = NAMED_AI_CRAWLERS.filter((agent) => !namedAgents.includes(agent));
  if (missing.length) {
    throw new Error(`robots.txt missing named AI crawler group(s): ${missing.join(", ")}`);
  }

  const wildcard = groups.filter((group) => group.agents.includes("*"));
  if (!wildcard.length) throw new Error("robots.txt must declare a User-agent: * rule");
  const wildcardRules = wildcard.flatMap((group) => group.rules);
  if (!wildcardRules.some((rule) => rule.type === "allow" && rule.path === "/"))
    throw new Error("robots.txt wildcard group must retain Allow: /");
  if (!wildcardRules.some((rule) => rule.type === "disallow" && rule.path === "/api/"))
    throw new Error("robots.txt wildcard group must retain Disallow: /api/");

  const publicPaths = ["/", "/llms.txt", "/blog/rss.xml", "/sitemap.xml", "/blog/"];
  for (const agent of NAMED_AI_CRAWLERS) {
    const groupsForAgent = matchingRobotsGroups(groups, agent);
    const rules = groupsForAgent.flatMap((group) => group.rules);
    if (!rules.some((rule) => rule.type === "allow" && rule.path === "/"))
      throw new Error(`${agent} group must explicitly contain Allow: /`);
    if (!rules.some((rule) => rule.type === "disallow" && rule.path === "/api/"))
      throw new Error(`${agent} group must retain Disallow: /api/`);
    for (const path of publicPaths) {
      if (!robotsAllowsPath(robots, path, agent))
        throw new Error(`${agent} group blocks public AEO path ${path}`);
    }
    if (robotsAllowsPath(robots, "/api/", agent))
      throw new Error(`${agent} group must block /api/`);
  }
  for (const path of publicPaths) {
    if (!robotsAllowsPath(robots, path, "*"))
      throw new Error(`wildcard group blocks public AEO path ${path}`);
  }
  if (robotsAllowsPath(robots, "/api/", "*"))
    throw new Error("wildcard group must block /api/");
  if (/citation|ranking|guarantee/i.test(robots))
    throw new Error("robots.txt must not claim AI citation or ranking guarantees");
  return { namedAgents, groups };
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

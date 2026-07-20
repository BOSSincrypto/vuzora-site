/**
 * Registry-driven RSS feed helpers for the static blog artifact.
 *
 * The feed is generated from the same post registry used by blog routes so
 * release validation can reject missing, phantom, or malformed entries.
 */

export const CANONICAL_ORIGIN = "https://vuzora.ru";
export const RSS_PATH = "/blog/rss.xml";
export const RSS_URL = `${CANONICAL_ORIGIN}${RSS_PATH}`;

const XML_ESCAPE_RE = /[<>&'\"]/g;
const XML_ESCAPE = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&apos;",
  '"': "&quot;",
};
const POST_URL_RE = /<link>https:\/\/vuzora\.ru\/blog\/([a-z0-9-]+)\/<\/link>/g;
const SECRET_PATTERN_RE =
  /\b(?:api[_-]?key|cloudflare|cf[-_]?api(?:[_-]?token)?|sk_live|sk_test|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-|Bearer\s+[A-Za-z0-9\-._~+/]+=*|DATABASE_URL|postgres(?:ql)?:\/\/\S+:\S+@|mongodb(?:\+srv)?:\/\/\S+:\S+@|AKIA[0-9A-Z]{16})\b/i;

function escapeXml(value) {
  return String(value).replace(XML_ESCAPE_RE, (character) => XML_ESCAPE[character]);
}

function postUrl(slug) {
  return `${CANONICAL_ORIGIN}/blog/${slug}/`;
}

export function dateToRfc822(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid blog post date: ${isoDate}`);
  return date.toUTCString();
}

/**
 * Build a deterministic RSS 2.0 feed from the committed blog posts.
 * @param {Array<{ slug: string, title: string, date: string, summary: string, body: readonly string[] }>} posts
 */
export function buildRssFeed(posts) {
  if (!Array.isArray(posts)) throw new Error("RSS posts input must be an array");
  const items = posts
    .map((post) => {
      if (!post?.slug || !post.title || !post.date || !post.summary) {
        throw new Error(`RSS post is incomplete: ${post?.slug ?? "unknown"}`);
      }
      const url = postUrl(post.slug);
      const description = [post.summary, ...(post.body ?? [])].join(" ");
      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <pubDate>${escapeXml(dateToRfc822(post.date))}</pubDate>`,
        `      <description>${escapeXml(description)}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const latestDate = posts.reduce(
    (latest, post) => (post.date > latest ? post.date : latest),
    "1970-01-01",
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    "    <title>Блог Vuzora</title>",
    `    <link>${CANONICAL_ORIGIN}/blog/</link>`,
    "    <description>Материалы Vuzora о расписании в Telegram и утренней доставке для студентов.</description>",
    `    <lastBuildDate>${escapeXml(dateToRfc822(latestDate))}</lastBuildDate>`,
    `    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${RSS_URL}" rel="self" type="application/rss+xml" />`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

/** Extract canonical blog URLs from RSS text. */
export function extractRssPostUrls(xml) {
  return [...xml.matchAll(POST_URL_RE)].map((match) => ({ url: match[0], slug: match[1] }));
}

const XML_NAME_RE = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const XML_ENTITY_RE = /^#(?:x[0-9A-Fa-f]+|[0-9]+)$/;

function isXmlWhitespace(character) {
  return character === " " || character === "\t" || character === "\n" || character === "\r";
}

function isValidXmlCodePoint(codePoint) {
  return (
    codePoint === 0x9 ||
    codePoint === 0xa ||
    codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  );
}

function assertXmlCharacters(value, context) {
  for (const character of value) {
    if (!isValidXmlCodePoint(character.codePointAt(0)))
      throw new Error(`RSS feed contains an invalid XML character in ${context}`);
  }
}

function assertXmlEntities(value, context) {
  let cursor = 0;
  while (cursor < value.length) {
    const ampersand = value.indexOf("&", cursor);
    if (ampersand === -1) break;
    const semicolon = value.indexOf(";", ampersand + 1);
    if (semicolon === -1) throw new Error(`RSS feed contains an unterminated XML entity in ${context}`);
    const entity = value.slice(ampersand + 1, semicolon);
    if (
      !["amp", "lt", "gt", "quot", "apos"].includes(entity) &&
      !XML_ENTITY_RE.test(entity)
    )
      throw new Error(`RSS feed contains an invalid XML entity in ${context}`);
    if (entity.startsWith("#")) {
      const codePoint = entity[1].toLowerCase() === "x"
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      if (!Number.isInteger(codePoint) || codePoint > 0x10ffff)
        throw new Error(`RSS feed contains an invalid XML entity in ${context}`);
      assertXmlCharacters(String.fromCodePoint(codePoint), "entity");
    }
    cursor = semicolon + 1;
  }
}

function assertXmlText(value, context) {
  assertXmlCharacters(value, context);
  assertXmlEntities(value, context);
  if (value.includes("<")) throw new Error(`RSS feed contains an unescaped less-than character in ${context}`);
}

function parseXmlAttributes(source) {
  const attributes = new Set();
  let cursor = 0;
  while (cursor < source.length) {
    while (cursor < source.length && isXmlWhitespace(source[cursor])) cursor += 1;
    if (cursor >= source.length) break;
    const nameStart = cursor;
    while (cursor < source.length && !isXmlWhitespace(source[cursor]) && !"=/>".includes(source[cursor]))
      cursor += 1;
    const name = source.slice(nameStart, cursor);
    if (!XML_NAME_RE.test(name) || attributes.has(name))
      throw new Error("RSS feed contains malformed or duplicate XML attributes");
    attributes.add(name);
    while (cursor < source.length && isXmlWhitespace(source[cursor])) cursor += 1;
    if (source[cursor] !== "=") throw new Error("RSS feed contains an unquoted XML attribute");
    cursor += 1;
    while (cursor < source.length && isXmlWhitespace(source[cursor])) cursor += 1;
    const quote = source[cursor];
    if (quote !== '"' && quote !== "'") throw new Error("RSS feed contains an unquoted XML attribute");
    cursor += 1;
    const valueStart = cursor;
    while (cursor < source.length && source[cursor] !== quote) cursor += 1;
    if (cursor >= source.length) throw new Error("RSS feed contains an unterminated XML attribute");
    const value = source.slice(valueStart, cursor);
    assertXmlCharacters(value, "attribute");
    assertXmlEntities(value, "attribute");
    if (value.includes("<")) throw new Error("RSS feed contains an unescaped less-than character in an attribute");
    cursor += 1;
    if (cursor < source.length && !isXmlWhitespace(source[cursor]))
      throw new Error("RSS feed contains XML attributes without a whitespace separator");
  }
  return [...attributes];
}

function assertXmlDeclaration(token) {
  const body = token.slice(5, -2).trim();
  if (!body.startsWith("version") || !/^(?:version)\s*=\s*["']1\.0["'](?:\s|$)/.test(body))
    throw new Error("RSS feed contains a malformed XML declaration");
  const attributes = parseXmlAttributes(body);
  const allowedOrders = [
    ["version"],
    ["version", "encoding"],
    ["version", "standalone"],
    ["version", "encoding", "standalone"],
  ];
  if (!allowedOrders.some((order) => order.length === attributes.length && order.every((name, index) => name === attributes[index])))
    throw new Error("RSS feed contains a malformed XML declaration");
  if (attributes.some((name) => !["version", "encoding", "standalone"].includes(name)))
    throw new Error("RSS feed contains a malformed XML declaration");
  if (attributes.includes("standalone") && !/\sstandalone\s*=\s*["'](?:yes|no)["']/.test(body))
    throw new Error("RSS feed contains a malformed XML declaration");
}

function assertWellFormedXml(xml) {
  const stack = [];
  let cursor = 0;
  let root;
  let hasRoot = false;
  let declarationSeen = false;
  const fail = (message) => {
    throw new Error(`RSS feed ${message}`);
  };
  while (cursor < xml.length) {
    if (xml[cursor] !== "<") {
      const textStart = cursor;
      const nextTag = xml.indexOf("<", cursor);
      cursor = nextTag === -1 ? xml.length : nextTag;
      const text = xml.slice(textStart, cursor);
      assertXmlText(text, stack.length ? `text in ${stack.at(-1)}` : "outside the root");
      if (!stack.length && text.trim()) fail("contains text outside the root element");
      continue;
    }

    if (xml.startsWith("<!--", cursor)) {
      const end = xml.indexOf("-->", cursor + 4);
      if (end === -1 || xml.slice(cursor + 4, end).includes("--")) fail("contains a malformed XML comment");
      cursor = end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", cursor)) {
      const end = xml.indexOf("]]>", cursor + 9);
      if (end === -1 || !stack.length) fail("contains a malformed XML CDATA section");
      assertXmlCharacters(xml.slice(cursor + 9, end), "CDATA");
      cursor = end + 3;
      continue;
    }
    if (xml.startsWith("<?", cursor)) {
      const end = xml.indexOf("?>", cursor + 2);
      if (end === -1) fail("contains a malformed XML declaration or processing instruction");
      const token = xml.slice(cursor, end + 2);
      if (token.startsWith("<?xml")) {
        if (cursor !== 0 || declarationSeen || hasRoot) fail("contains a misplaced XML declaration");
        assertXmlDeclaration(token);
        declarationSeen = true;
      } else if (!/^<\?[A-Za-z_][A-Za-z0-9_.:-]*(?:\s[^?]*)?\?>$/.test(token)) {
        fail("contains a malformed processing instruction");
      }
      cursor = end + 2;
      continue;
    }
    if (xml.startsWith("<!", cursor)) fail("contains a malformed XML declaration");

    const end = xml.indexOf(">", cursor + 1);
    if (end === -1) fail("contains an unterminated XML tag");
    const token = xml.slice(cursor, end + 1);
    if (token.startsWith("</")) {
      const match = token.match(/^<\/([A-Za-z_][A-Za-z0-9_.:-]*)\s*>$/);
      if (!match || stack.pop() !== match[1]) fail("contains mismatched XML tags");
      cursor = end + 1;
      continue;
    }
    const opening = token.match(/^<([A-Za-z_][A-Za-z0-9_.:-]*)([\s\S]*?)(\/?)>$/);
    if (!opening) fail("contains a malformed XML tag");
    const [, name, attributes, selfClosing] = opening;
    if (!root) {
      root = name;
      hasRoot = true;
    } else if (!stack.length) {
      fail("contains multiple XML roots");
    }
    parseXmlAttributes(selfClosing ? attributes.slice(0, -1) : attributes);
    if (!selfClosing) stack.push(name);
    cursor = end + 1;
  }
  if (!hasRoot || stack.length || root !== "rss") fail("is incomplete or has an invalid root");
}

function decodeXmlText(value) {
  return value.replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) =>
    ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" })[entity],
  );
}

function extractTagValues(xml, tagName) {
  const tag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi"))].map(
    (match) => decodeXmlText(match[1]),
  );
}

/**
 * Fail closed unless an RSS body is well-formed enough for the static release
 * contract and exactly joins the expected blog post slugs.
 * @param {string} xml
 * @param {Array<{ slug: string, title?: string }>} posts
 */
export function assertRssJoin(xml, posts) {
  if (typeof xml !== "string" || !xml.trim()) throw new Error("RSS feed is empty or missing");
  if (!/^<\?xml\s[^>]*encoding=["']UTF-8["']/i.test(xml.trim()))
    throw new Error("RSS feed must declare UTF-8 XML encoding");
  if (!/<rss\s[^>]*version=["']2\.0["'][^>]*>/i.test(xml))
    throw new Error("RSS feed root must be RSS 2.0");
  assertWellFormedXml(xml);
  if (!/<channel>[\s\S]*<\/channel>/i.test(xml)) throw new Error("RSS feed is missing channel");
  if (SECRET_PATTERN_RE.test(xml)) throw new Error("RSS feed contains secret-like credential patterns");

  const expected = posts.filter((post) => post?.slug);
  const expectedSlugs = expected.map((post) => post.slug);
  const expectedSet = new Set(expectedSlugs);
  const itemBodies = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  if (itemBodies.length !== expected.length)
    throw new Error(`RSS item count mismatch: expected ${expected.length}, found ${itemBodies.length}`);

  const links = itemBodies.map((item) => extractTagValues(item, "link")[0] ?? "");
  const guids = itemBodies.map((item) => extractTagValues(item, "guid")[0] ?? "");
  const slugs = links.map((link) => {
    const match = link.match(/^https:\/\/vuzora\.ru\/blog\/([a-z0-9-]+)\/$/);
    if (!match) throw new Error(`RSS item has non-canonical blog link: ${link || "missing"}`);
    return match[1];
  });
  if (new Set(slugs).size !== slugs.length) throw new Error("RSS feed contains duplicate post links");
  const missing = expectedSlugs.filter((slug) => !slugs.includes(slug));
  if (missing.length) throw new Error(`RSS underlist: missing post(s): ${missing.join(", ")}`);
  const phantom = slugs.filter((slug) => !expectedSet.has(slug));
  if (phantom.length) throw new Error(`RSS overlist: phantom post(s): ${[...new Set(phantom)].join(", ")}`);

  for (let index = 0; index < expected.length; index += 1) {
    const expectedUrl = postUrl(expected[index].slug);
    if (guids[index] !== expectedUrl)
      throw new Error(`RSS guid mismatch for ${expected[index].slug}`);
    const title = extractTagValues(itemBodies[index], "title")[0] ?? "";
    if (!title) throw new Error(`RSS item missing title for ${expected[index].slug}`);
    if (expected[index].title && title !== expected[index].title)
      throw new Error(`RSS title mismatch for ${expected[index].slug}`);
    const pubDates = extractTagValues(itemBodies[index], "pubDate");
    if (pubDates.length !== 1 || !pubDates[0])
      throw new Error(`RSS item missing publication date for ${expected[index].slug}`);
    if (pubDates[0] !== dateToRfc822(expected[index].date))
      throw new Error(`RSS publication date mismatch for ${expected[index].slug}`);
    if (!extractTagValues(itemBodies[index], "description")[0])
      throw new Error(`RSS item missing description for ${expected[index].slug}`);
  }

  return { expectedCount: expected.length, foundCount: slugs.length, slugs };
}

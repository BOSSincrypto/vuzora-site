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
const POST_URL_RE = /<link>https:\/\/vuzora\.ru\/blog\/([a-z0-9-]+)<\/link>/g;
const SECRET_PATTERN_RE =
  /\b(?:api[_-]?key|cloudflare|cf[-_]?api(?:[_-]?token)?|sk_live|sk_test|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-|Bearer\s+[A-Za-z0-9\-._~+/]+=*|DATABASE_URL|postgres(?:ql)?:\/\/\S+:\S+@|mongodb(?:\+srv)?:\/\/\S+:\S+@|AKIA[0-9A-Z]{16})\b/i;

function escapeXml(value) {
  return String(value).replace(XML_ESCAPE_RE, (character) => XML_ESCAPE[character]);
}

function postUrl(slug) {
  return `${CANONICAL_ORIGIN}/blog/${slug}`;
}

function dateToRfc822(isoDate) {
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

function assertWellFormedXml(xml) {
  const tokens = /<!--[^]*?-->|<\?xml[^]*?\?>|<!\[CDATA\[[^]*?\]\]>|<\/?[A-Za-z][^>]*>|[^<]+/g;
  const stack = [];
  let cursor = 0;
  let root;
  for (const match of xml.matchAll(tokens)) {
    if (match.index !== cursor) throw new Error("RSS feed contains malformed XML");
    const token = match[0];
    cursor += token.length;
    if (!token.startsWith("<") || token.startsWith("<!--") || token.startsWith("<![CDATA[")) continue;
    if (token.startsWith("<?xml")) continue;
    if (token.startsWith("</")) {
      const name = token.match(/^<\/([A-Za-z][\w:.-]*)\s*>$/)?.[1];
      if (!name || stack.pop() !== name) throw new Error("RSS feed contains mismatched XML tags");
      continue;
    }
    const name = token.match(/^<([A-Za-z][\w:.-]*)\b/)?.[1];
    if (!name) throw new Error("RSS feed contains malformed XML tag");
    if (root) {
      if (!stack.length) throw new Error("RSS feed contains multiple XML roots");
    } else root = name;
    if (!/\/\s*>$/.test(token)) stack.push(name);
  }
  if (cursor !== xml.length || stack.length || root !== "rss")
    throw new Error("RSS feed XML is incomplete or has an invalid root");
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
    const match = link.match(/^https:\/\/vuzora\.ru\/blog\/([a-z0-9-]+)$/);
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
    if (!extractTagValues(itemBodies[index], "pubDate")[0])
      throw new Error(`RSS item missing publication date for ${expected[index].slug}`);
    if (!extractTagValues(itemBodies[index], "description")[0])
      throw new Error(`RSS item missing description for ${expected[index].slug}`);
  }

  return { expectedCount: expected.length, foundCount: slugs.length, slugs };
}

export const BLOG_INDEX_ROUTE = "/blog/";

export function blogDetailRoute(slug) {
  return `/blog/${slug}`;
}

export function blogRouteUrl(route) {
  return `https://vuzora.ru${route}`;
}

function flattenJsonLd(value) {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== "object") return [];
  return value["@graph"] ? [value, ...flattenJsonLd(value["@graph"])] : [value];
}

function typeOf(node) {
  return Array.isArray(node?.["@type"]) ? node["@type"] : node?.["@type"] ? [node["@type"]] : [];
}

function parseAttributes(source) {
  const attrs = {};
  for (const match of source.matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  }
  return attrs;
}

/**
 * Parse only the metadata surfaces needed by the blog identity contract.
 * This intentionally does not normalize slashes, so mixed variants remain
 * observable to release tests.
 */
export function parseBlogMetadata(source) {
  if (typeof source !== "string") return source;
  const canonicals = [...source.matchAll(/<link\b([^>]*\brel\s*=\s*["'][^"']*canonical[^"']*["'][^>]*)>/gi)]
    .map((match) => parseAttributes(match[1]).href ?? "");
  const metas = [...source.matchAll(/<meta\b([^>]*)>/gi)].map((match) => parseAttributes(match[1]));
  const jsonLd = [...source.matchAll(
    /<script\b([^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi,
  )].map((match) => JSON.parse(match[2].trim()));
  const htmlLang = source.match(/<html\b([^>]*)>/i)?.[1] ?? "";
  const readMeta = (key, value) =>
    metas
      .filter((meta) => meta[key] === value)
      .map((meta) => meta.content ?? "");
  return {
    htmlLang: parseAttributes(htmlLang).lang ?? "",
    canonicals,
    jsonLd,
    meta: readMeta,
    nodes: jsonLd.flatMap(flattenJsonLd),
  };
}

function expectedIndexBreadcrumb() {
  return [
    { position: 1, name: "Главная", item: blogRouteUrl("/") },
    { position: 2, name: "Блог", item: blogRouteUrl(BLOG_INDEX_ROUTE) },
  ];
}

function expectedDetailBreadcrumb(post, route) {
  return [
    { position: 1, name: "Главная", item: blogRouteUrl("/") },
    { position: 2, name: "Блог", item: blogRouteUrl(BLOG_INDEX_ROUTE) },
    { position: 3, name: post.title, item: blogRouteUrl(route) },
  ];
}

function assertExact(condition, message, failures) {
  if (!condition) failures.push(message);
}

function assertBreadcrumb(node, expected, route, failures) {
  const items = node?.itemListElement;
  assertExact(Array.isArray(items) && items.length === expected.length, `${route}: breadcrumb item count mismatch`, failures);
  if (!Array.isArray(items)) return;
  for (let index = 0; index < expected.length; index += 1) {
    const actual = items[index];
    const wanted = expected[index];
    assertExact(
      actual?.position === wanted.position &&
        actual?.name === wanted.name &&
        actual?.item === wanted.item,
      `${route}: breadcrumb identity mismatch at position ${wanted.position}`,
      failures,
    );
  }
}

/**
 * Assert the complete blog URL, locale, and OpenGraph identity policy.
 * Throws one aggregate error so fixture tests can assert fail-closed behavior.
 */
export function assertBlogMetadataConsistency(source, route, posts = []) {
  const document = parseBlogMetadata(source);
  const failures = [];
  const isIndex = route === BLOG_INDEX_ROUTE;
  const post = posts.find((candidate) => `/blog/${candidate.slug}` === route);
  const expectedUrl = blogRouteUrl(route);
  const canonical = document.canonicals;
  const ogUrl = document.meta("property", "og:url");
  const ogType = document.meta("property", "og:type");
  const locale = document.meta("property", "og:locale");

  assertExact(document.htmlLang === "ru", `${route}: HTML language must be ru`, failures);
  assertExact(locale.length === 1 && locale[0] === "ru_RU", `${route}: Russian OpenGraph locale is missing or duplicated`, failures);
  assertExact(canonical.length === 1 && canonical[0] === expectedUrl, `${route}: canonical mismatch`, failures);
  assertExact(ogUrl.length === 1 && ogUrl[0] === expectedUrl, `${route}: og:url mismatch`, failures);
  assertExact(
    ogType.length === 1 && ogType[0] === (isIndex ? "website" : "article"),
    `${route}: og:type must be ${isIndex ? "website" : "article"}`,
    failures,
  );

  const breadcrumbs = document.nodes.filter((node) => typeOf(node).includes("BreadcrumbList"));
  assertExact(breadcrumbs.length === 1, `${route}: expected exactly one blog BreadcrumbList`, failures);
  if (breadcrumbs.length === 1) {
    assertBreadcrumb(
      breadcrumbs[0],
      isIndex ? expectedIndexBreadcrumb() : expectedDetailBreadcrumb(post ?? {}, route),
      route,
      failures,
    );
  }

  if (isIndex) {
    const blogs = document.nodes.filter((node) => typeOf(node).includes("Blog"));
    assertExact(blogs.length === 1, `${route}: expected exactly one Blog JSON-LD node`, failures);
    const blog = blogs[0];
    assertExact(blog?.["@id"] === `${expectedUrl}#blog`, `${route}: Blog JSON-LD @id mismatch`, failures);
    assertExact(blog?.url === expectedUrl, `${route}: Blog JSON-LD url mismatch`, failures);
    assertExact(blog?.inLanguage === "ru", `${route}: Blog JSON-LD language mismatch`, failures);
    const entries = Array.isArray(blog?.blogPost) ? blog.blogPost : [];
    assertExact(entries.length === posts.length, `${route}: Blog JSON-LD post count mismatch`, failures);
    for (const candidate of posts) {
      const entry = entries.find((item) => item?.headline === candidate.title);
      assertExact(
        entry?.url === blogRouteUrl(blogDetailRoute(candidate.slug)),
        `${route}: Blog JSON-LD URL mismatch for ${candidate.slug}`,
        failures,
      );
    }
  } else {
    assertExact(Boolean(post), `${route}: missing registry blog post`, failures);
    const published = document.meta("property", "article:published_time");
    const modified = document.meta("property", "article:modified_time");
    const section = document.meta("property", "article:section");
    const author = document.meta("property", "article:author");
    assertExact(published.length === 1 && published[0] === post?.date, `${route}: article published_time mismatch`, failures);
    assertExact(modified.length === 1 && modified[0] === post?.date, `${route}: article modified_time mismatch`, failures);
    assertExact(section.length === 1 && section[0] === "Блог", `${route}: article section metadata mismatch`, failures);
    assertExact(author.length === 1 && author[0] === "Vuzora", `${route}: article author metadata mismatch`, failures);
    const postings = document.nodes.filter((node) => typeOf(node).includes("BlogPosting"));
    assertExact(postings.length === 1, `${route}: expected exactly one BlogPosting JSON-LD node`, failures);
    const posting = postings[0];
    for (const [field, value] of [
      ["@id", `${expectedUrl}#post`],
      ["mainEntityOfPage", expectedUrl],
      ["url", expectedUrl],
      ["headline", post?.title],
      ["datePublished", post?.date],
      ["dateModified", post?.date],
      ["inLanguage", "ru"],
    ]) {
      assertExact(posting?.[field] === value, `${route}: BlogPosting ${field} mismatch`, failures);
    }
  }

  if (failures.length) throw new Error(failures.join("\n"));
  return true;
}

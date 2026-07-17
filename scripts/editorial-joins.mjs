/**
 * Release-time joins for the crawlable editorial graph.
 *
 * The source registries remain authoritative. These checks only compare the
 * static HTML documents emitted from those registries, so a stale index or
 * broken internal link cannot ship alongside a valid RSS/sitemap set.
 */

const BLOG_DETAIL_RE = /^\/blog\/([a-z0-9-]+)$/;
const UNIVERSITY_DETAIL_RE = /^\/unis\/([a-z0-9-]+)$/;
export const EDITORIAL_HUB_SLUG = "raspisanie-vuzov-v-telegram";

function routeHrefs(document, pattern) {
  return document.anchors
    .map((anchor) => anchor.href ?? "")
    .map((href) => href.match(pattern)?.[1])
    .filter(Boolean);
}

function assertExactSet(actual, expected, label) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const duplicates = actual.filter((value, index) => actual.indexOf(value) !== index);
  const missing = expected.filter((value) => !actualSet.has(value));
  const extra = actual.filter((value) => !expectedSet.has(value));
  if (duplicates.length || missing.length || extra.length || actual.length !== expected.length) {
    const details = [
      duplicates.length ? `duplicates: ${[...new Set(duplicates)].join(", ")}` : "",
      missing.length ? `missing: ${missing.join(", ")}` : "",
      extra.length ? `extra: ${[...new Set(extra)].join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("; ");
    throw new Error(`${label} set mismatch (${details || "cardinality mismatch"})`);
  }
}

/**
 * Ensure the blog index has exactly one crawlable listing link for every post.
 * @param {{ anchors: Array<{ href?: string }>, text: string }} document
 * @param {Array<{ slug: string, title?: string }>} posts
 */
export function assertBlogIndexJoin(document, posts) {
  if (!document) throw new Error("blog index document is missing");
  const expectedSlugs = posts.map((post) => post.slug);
  const actualSlugs = routeHrefs(document, BLOG_DETAIL_RE);
  assertExactSet(actualSlugs, expectedSlugs, "blog index post links");
  for (const post of posts) {
    if (post.title && !document.text.includes(post.title))
      throw new Error(`blog index is missing post title: ${post.slug}`);
  }
  return { expectedCount: expectedSlugs.length, foundCount: actualSlugs.length, slugs: actualSlugs };
}

/**
 * Ensure hub, focused posts, and university details form a crawlable graph.
 * @param {{
 *   documents: Map<string, { anchors: Array<{ href?: string }>, text: string }>,
 *   posts: Array<{ slug: string }>,
 *   universities: Array<{ slug: string }>
 * }} input
 */
export function assertEditorialGraph({ documents, posts, universities }) {
  const hubRoute = `/blog/${EDITORIAL_HUB_SLUG}`;
  const hub = documents.get(hubRoute);
  if (!hub) throw new Error(`editorial hub artifact is missing: ${hubRoute}`);

  const expectedUniversitySlugs = universities.map((university) => university.slug);
  const hubUniversitySlugs = routeHrefs(hub, UNIVERSITY_DETAIL_RE);
  assertExactSet(hubUniversitySlugs, expectedUniversitySlugs, "editorial hub university links");

  const postSlugs = new Set(posts.map((post) => post.slug));
  if (!postSlugs.has(EDITORIAL_HUB_SLUG))
    throw new Error(`editorial hub is absent from POSTS: ${EDITORIAL_HUB_SLUG}`);
  const hubBlogSlugs = [...new Set(routeHrefs(hub, BLOG_DETAIL_RE))].filter(
    (slug) => slug !== EDITORIAL_HUB_SLUG,
  );
  for (const slug of hubBlogSlugs) {
    if (!postSlugs.has(slug)) throw new Error(`editorial hub links unknown post: ${slug}`);
  }
  const focusedSlugs = posts
    .filter((post) => post.slug !== EDITORIAL_HUB_SLUG)
    .filter((post) => {
      const document = documents.get(`/blog/${post.slug}`);
      return document && routeHrefs(document, UNIVERSITY_DETAIL_RE).length === 1;
    })
    .map((post) => post.slug);
  if (!focusedSlugs.length) throw new Error("editorial hub has no focused post links");
  assertExactSet(
    hubBlogSlugs.filter((slug) => focusedSlugs.includes(slug)),
    focusedSlugs,
    "editorial hub focused post links",
  );
  for (const slug of focusedSlugs) {
    const postDocument = documents.get(`/blog/${slug}`);
    if (!postDocument) throw new Error(`focused post artifact is missing: /blog/${slug}`);
    const postHubLinks = routeHrefs(postDocument, BLOG_DETAIL_RE).filter(
      (linkedSlug) => linkedSlug === EDITORIAL_HUB_SLUG,
    );
    if (!postHubLinks.length)
      throw new Error(`focused post must link back to hub: ${slug}`);
    const postUniversitySlugs = routeHrefs(postDocument, UNIVERSITY_DETAIL_RE);
    if (postUniversitySlugs.length !== 1)
      throw new Error(`focused post must link to exactly one university detail: ${slug}`);
    if (!expectedUniversitySlugs.includes(postUniversitySlugs[0]))
      throw new Error(`focused post links unknown university: ${slug}`);
    const detailDocument = documents.get(`/unis/${postUniversitySlugs[0]}`);
    if (!detailDocument)
      throw new Error(`focused post target artifact is missing: ${postUniversitySlugs[0]}`);
    const detailEditorialLinks = routeHrefs(detailDocument, BLOG_DETAIL_RE).filter((linkedSlug) =>
      linkedSlug === EDITORIAL_HUB_SLUG || focusedSlugs.includes(linkedSlug),
    );
    if (!detailEditorialLinks.length)
      throw new Error(`university detail lacks an editorial link: ${postUniversitySlugs[0]}`);
  }

  return {
    hubSlug: EDITORIAL_HUB_SLUG,
    universityCount: hubUniversitySlugs.length,
    focusedPostSlugs: focusedSlugs,
  };
}

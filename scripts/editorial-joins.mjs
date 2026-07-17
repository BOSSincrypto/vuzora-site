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
export const FOCUSED_POST_MIN = 8;
export const FOCUSED_POST_MAX = 12;

function routeHrefs(document, pattern, predicate = () => true) {
  return document.anchors
    .filter(predicate)
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
 *   posts: Array<{ slug: string, universitySlug?: string | null }>,
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
  const focusedPosts = posts.filter(
    (post) => post.slug !== EDITORIAL_HUB_SLUG && post.universitySlug,
  );
  if (
    focusedPosts.length < FOCUSED_POST_MIN ||
    focusedPosts.length > FOCUSED_POST_MAX
  ) {
    throw new Error(
      `focused post count must be between ${FOCUSED_POST_MIN} and ${FOCUSED_POST_MAX}: ${focusedPosts.length}`,
    );
  }
  const expectedUniversitySet = new Set(expectedUniversitySlugs);
  const targetToPost = new Map();
  for (const post of focusedPosts) {
    const target = post.universitySlug;
    if (!expectedUniversitySet.has(target)) {
      throw new Error(`focused post links unknown university in metadata: ${post.slug} -> ${target}`);
    }
    const previous = targetToPost.get(target);
    if (previous) {
      throw new Error(`focused posts share university target: ${previous} and ${post.slug} -> ${target}`);
    }
    targetToPost.set(target, post.slug);
  }
  const focusedSlugs = focusedPosts.map((post) => post.slug);
  for (const post of posts) {
    if (post.slug === EDITORIAL_HUB_SLUG || post.universitySlug) continue;
    const links = routeHrefs(documents.get(`/blog/${post.slug}`), UNIVERSITY_DETAIL_RE);
    if (links.length) {
      throw new Error(`post with a university detail link lacks focused metadata: ${post.slug}`);
    }
  }
  assertExactSet(
    hubBlogSlugs.filter((slug) => focusedSlugs.includes(slug)),
    focusedSlugs,
    "editorial hub focused post links",
  );
  for (const slug of focusedSlugs) {
    const postDocument = documents.get(`/blog/${slug}`);
    if (!postDocument) throw new Error(`focused post artifact is missing: /blog/${slug}`);
    // Ignore the generated previous/next navigation. The authored editorial
    // body links use the amber link class and must contain exactly one hub edge.
    const postHubLinks = routeHrefs(
      postDocument,
      BLOG_DETAIL_RE,
      (anchor) => anchor.class?.includes("text-amber"),
    ).filter(
      (linkedSlug) => linkedSlug === EDITORIAL_HUB_SLUG,
    );
    if (postHubLinks.length !== 1)
      throw new Error(`focused post must link back to hub exactly once: ${slug}`);
    const postUniversitySlugs = routeHrefs(postDocument, UNIVERSITY_DETAIL_RE);
    if (postUniversitySlugs.length !== 1)
      throw new Error(`focused post must link to exactly one university detail: ${slug}`);
    const configuredUniversitySlug = posts.find((post) => post.slug === slug).universitySlug;
    if (!expectedUniversitySet.has(postUniversitySlugs[0])) {
      throw new Error(`focused post links unknown university: ${slug} -> ${postUniversitySlugs[0]}`);
    }
    if (postUniversitySlugs[0] !== configuredUniversitySlug) {
      throw new Error(
        `focused post links wrong university: ${slug} -> ${postUniversitySlugs[0]} (expected ${configuredUniversitySlug})`,
      );
    }
    const detailDocument = documents.get(`/unis/${configuredUniversitySlug}`);
    if (!detailDocument)
      throw new Error(`focused post target artifact is missing: ${configuredUniversitySlug}`);
    const detailEditorialLinks = routeHrefs(detailDocument, BLOG_DETAIL_RE).filter((linkedSlug) =>
      linkedSlug === EDITORIAL_HUB_SLUG || focusedSlugs.includes(linkedSlug),
    );
    if (!detailEditorialLinks.length)
      throw new Error(`university detail lacks an editorial link: ${configuredUniversitySlug}`);
    if (detailEditorialLinks.length !== 1)
      throw new Error(
        `university detail has duplicate editorial links: ${configuredUniversitySlug}`,
      );
  }

  return {
    hubSlug: EDITORIAL_HUB_SLUG,
    universityCount: hubUniversitySlugs.length,
    focusedPostSlugs: focusedSlugs,
  };
}

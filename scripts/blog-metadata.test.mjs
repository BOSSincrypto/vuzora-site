import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  BLOG_INDEX_ROUTE,
  assertBlogMetadataConsistency,
  blogRouteUrl,
  parseBlogMetadata,
} from "./blog-metadata.mjs";

const root = process.cwd();
const post = {
  slug: "msu-utrenniy-plan",
  title: "МГУ: как превратить утреннее расписание в план дня",
  date: "2026-07-08",
};
const posts = [post];

function html(route, { canonical = blogRouteUrl(route), ogUrl = canonical, ogType, locale = "ru_RU", breadcrumbUrl = blogRouteUrl(BLOG_INDEX_ROUTE), duplicateCanonical = false } = {}) {
  const index = route === BLOG_INDEX_ROUTE;
  const type = ogType ?? (index ? "website" : "article");
  const jsonLd = index
    ? [
        {
          "@context": "https://schema.org",
          "@type": "Blog",
          "@id": `${canonical}#blog`,
          url: canonical,
          inLanguage: "ru",
          blogPost: [{ "@type": "BlogPosting", headline: post.title, url: blogRouteUrl(`/blog/${post.slug}`) }],
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { position: 1, name: "Главная", item: blogRouteUrl("/") },
            { position: 2, name: "Блог", item: breadcrumbUrl },
          ],
        },
      ]
    : [
        {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "@id": `${canonical}#post`,
          mainEntityOfPage: canonical,
          url: canonical,
          headline: post.title,
          datePublished: post.date,
          dateModified: post.date,
          inLanguage: "ru",
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { position: 1, name: "Главная", item: blogRouteUrl("/") },
            { position: 2, name: "Блог", item: breadcrumbUrl },
            { position: 3, name: post.title, item: canonical },
          ],
        },
      ];
  return `<!doctype html><html lang="ru"><head>
    <link rel="canonical" href="${canonical}">${duplicateCanonical ? `<link rel="canonical" href="${canonical}">` : ""}
    <meta property="og:url" content="${ogUrl}">
    <meta property="og:type" content="${type}">
    <meta property="og:locale" content="${locale}">
    ${index ? "" : `<meta property="article:published_time" content="${post.date}"><meta property="article:modified_time" content="${post.date}"><meta property="article:section" content="Блог"><meta property="article:author" content="Vuzora">`}
    <script type="application/ld+json">${JSON.stringify(jsonLd[0])}</script>
    <script type="application/ld+json">${JSON.stringify(jsonLd[1])}</script>
  </head><body></body></html>`;
}

test("blog metadata parser preserves exact slash variants and JSON-LD nodes", () => {
  const parsed = parseBlogMetadata(html(BLOG_INDEX_ROUTE));
  assert.deepEqual(parsed.canonicals, ["https://vuzora.ru/blog/"]);
  assert.deepEqual(parsed.meta("property", "og:url"), ["https://vuzora.ru/blog/"]);
  assert.equal(parsed.nodes.find((node) => node["@type"] === "Blog").url, "https://vuzora.ru/blog/");
});

test("blog index and detail fixtures satisfy the shared URL policy", () => {
  assert.doesNotThrow(() => assertBlogMetadataConsistency(html(BLOG_INDEX_ROUTE), BLOG_INDEX_ROUTE, posts));
  assert.doesNotThrow(() => assertBlogMetadataConsistency(html(`/blog/${post.slug}`), `/blog/${post.slug}`, posts));
});

test("blog metadata rejects mixed slash, cross-post, missing locale, duplicate canonical, and non-article detail fixtures", () => {
  assert.throws(
    () => assertBlogMetadataConsistency(html(BLOG_INDEX_ROUTE, { canonical: "https://vuzora.ru/blog", ogUrl: "https://vuzora.ru/blog/" }), BLOG_INDEX_ROUTE, posts),
    /canonical mismatch/,
  );
  assert.throws(
    () => assertBlogMetadataConsistency(html(`/blog/${post.slug}`, { canonical: "https://vuzora.ru/blog/another-post" }), `/blog/${post.slug}`, posts),
    /canonical mismatch|BlogPosting/,
  );
  assert.throws(
    () => assertBlogMetadataConsistency(html(`/blog/${post.slug}`, { locale: "" }), `/blog/${post.slug}`, posts),
    /locale/,
  );
  assert.throws(
    () => assertBlogMetadataConsistency(html(`/blog/${post.slug}`, { duplicateCanonical: true }), `/blog/${post.slug}`, posts),
    /canonical mismatch/,
  );
  assert.throws(
    () => assertBlogMetadataConsistency(html(`/blog/${post.slug}`, { ogType: "website" }), `/blog/${post.slug}`, posts),
    /og:type/,
  );
});

test("source keeps the canonical blog index path on navigation surfaces", async () => {
  const files = [
    "src/routes/blog.index.tsx",
    "src/routes/blog.$slug.tsx",
    "src/routes/__root.tsx",
    "src/components/vuzora/NavBar.tsx",
    "src/components/vuzora/nav/MobileMenu.tsx",
    "src/components/vuzora/Footer.tsx",
  ];
  const sources = await Promise.all(files.map((file) => readFile(join(root, file), "utf8")));
  assert.match(sources[0], /BLOG_INDEX_PATH/);
  assert.match(sources[1], /article:modified_time/);
  for (const source of sources.slice(2)) assert.doesNotMatch(source, /href="\/blog"/);
});

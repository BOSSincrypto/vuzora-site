/**
 * Development/preview `/sitemap.xml` handler.
 *
 * NOT the shipped artifact. `scripts/prepare-release.mjs` overwrites
 * `dist/sitemap.xml` with the registry/route-policy set so seeds and release
 * validation share one explicit list; this handler only answers `vite dev` and
 * `vite preview`. The two agree on the URL set and on lastmod semantics: a
 * date is emitted only where one is provable. Blog surfaces prove theirs from
 * the post records, which is all this handler can reach; the release also
 * dates the other routes from git (`scripts/route-lastmod.mjs`), which needs a
 * repository and so stays out of the SSR bundle. Neither ever stamps the
 * current day on a page that did not change — a lastmod that moves nightly is
 * one crawlers learn to discount. This one additionally emits
 * `changefreq`/`priority`, which the released file omits.
 * Fix drift in `scripts/route-policy.mjs` first; editing this file alone
 * changes nothing that GitHub Pages serves.
 *
 * @module routes/sitemap.xml
 */

import { createFileRoute } from "@tanstack/react-router";
import { blogPostPath, POSTS } from "@/content/blog";
import { UNIVERSITIES, abs, universityPagePath } from "@/content/vuzora";

type Entry = { path: string; lastmod?: string; changefreq: string; priority: string };

// The RSS feed is deliberately absent: a sitemap offers pages to the index and
// a feed has nothing to index, so listing it only ever earned Google's
// "crawled – currently not indexed". `DISCOVERY_LINKS` in `src/content/seo.ts`
// still advertises it from every page head, and llms.txt still lists it.
function buildEntries(): Entry[] {
  const latestPost = POSTS.reduce((acc, p) => (p.date > acc ? p.date : acc), "1970-01-01");
  return [
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/pricing/", changefreq: "weekly", priority: "0.9" },
    { path: "/unis/", changefreq: "monthly", priority: "0.7" },
    { path: "/blog/", lastmod: latestPost, changefreq: "weekly", priority: "0.8" },
    { path: "/changelog/", changefreq: "weekly", priority: "0.5" },
    ...POSTS.map<Entry>((p) => ({
      path: blogPostPath(p.slug),
      lastmod: p.date,
      changefreq: "monthly",
      priority: "0.6",
    })),
    { path: "/legal/terms/", changefreq: "yearly", priority: "0.3" },
    { path: "/legal/privacy/", changefreq: "yearly", priority: "0.3" },
    ...UNIVERSITIES.map<Entry>((u) => ({
      path: universityPagePath(u.slug),
      changefreq: "monthly",
      priority: "0.8",
    })),
  ];
}

function buildSitemap() {
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    buildEntries()
      .map(
        (e) =>
          `  <url><loc>${abs(e.path)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}<changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
      )
      .join("\n") +
    `\n</urlset>\n`;
  return body;
}

// Module-scope cache. Nothing in the entry set depends on the clock any more —
// every date comes from the committed post records — so one build per process
// is enough; a restart picks up new posts.
let cached: string | undefined;
function getSitemap() {
  cached ??= buildSitemap();
  return cached;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        try {
          return new Response(getSitemap(), {
            headers: {
              "content-type": "application/xml; charset=utf-8",
              "cache-control": "public, max-age=3600",
            },
          });
        } catch (err) {
          console.error("[vuzora:sitemap]", err);
          throw err;
        }
      },
    },
  },
});

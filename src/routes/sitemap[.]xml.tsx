import { createFileRoute } from "@tanstack/react-router";
import { POSTS } from "@/content/blog";
import { UNIVERSITIES, abs, universityPagePath } from "@/content/vuzora";

type Entry = { path: string; lastmod: string; changefreq: string; priority: string };

function buildEntries(): Entry[] {
  const today = new Date().toISOString().slice(0, 10);
  const latestPost = POSTS.reduce((acc, p) => (p.date > acc ? p.date : acc), "1970-01-01");
  return [
    { path: "/", lastmod: today, changefreq: "weekly", priority: "1.0" },
    { path: "/pricing", lastmod: today, changefreq: "weekly", priority: "0.9" },
    { path: "/unis", lastmod: today, changefreq: "monthly", priority: "0.7" },
    { path: "/blog/", lastmod: latestPost, changefreq: "weekly", priority: "0.8" },
    { path: "/blog/rss.xml", lastmod: latestPost, changefreq: "weekly", priority: "0.4" },
    { path: "/changelog", lastmod: today, changefreq: "weekly", priority: "0.5" },
    ...POSTS.map<Entry>((p) => ({
      path: `/blog/${p.slug}`,
      lastmod: p.date,
      changefreq: "monthly",
      priority: "0.6",
    })),
    { path: "/legal/terms", lastmod: today, changefreq: "yearly", priority: "0.3" },
    { path: "/legal/privacy", lastmod: today, changefreq: "yearly", priority: "0.3" },
    ...UNIVERSITIES.map<Entry>((u) => ({
      path: universityPagePath(u.slug),
      lastmod: today,
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
          `  <url><loc>${abs(e.path)}</loc><lastmod>${e.lastmod}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
      )
      .join("\n") +
    `\n</urlset>\n`;
  return body;
}

// Module-scope cache: rebuild at most once per UTC day. The entry set only
// changes when POSTS or the current date changes, so this avoids re-stringifying
// on every crawler hit while still keeping `lastmod` fresh.
let cached: { day: string; xml: string } | undefined;
function getSitemap() {
  const day = new Date().toISOString().slice(0, 10);
  if (!cached || cached.day !== day) cached = { day, xml: buildSitemap() };
  return cached.xml;
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

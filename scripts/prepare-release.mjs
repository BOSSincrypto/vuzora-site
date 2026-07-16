import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildRoutes, manifestFor, readRegistry } from "./route-policy.mjs";

const root = process.cwd();
const dist = join(root, "dist");
const CANONICAL_ORIGIN = "https://vuzora.ru";

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

function buildAuthoritativeSitemap(routes, lastmod) {
  const body = routes
    .map(
      (route) => `  <url><loc>${CANONICAL_ORIGIN}${route}</loc><lastmod>${lastmod}</lastmod></url>`,
    )
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n` +
    `</urlset>\n`
  );
}

// TanStack serializes a wall-clock `updatedAt` into every prerendered hydration
// payload. It is cache metadata, not page content, so freeze it for reproducible
// Pages artifacts while the client still refreshes it after hydration.
for (const path of await htmlFiles(dist)) {
  const html = await readFile(path, "utf8");
  const normalized = html.replace(/u:\d{13}/g, "u:0");
  if (normalized !== html) await writeFile(path, normalized);
}

const { universities, posts } = await readRegistry();
const routes = buildRoutes({ universities, posts });
// Freeze lastmod to the UTC calendar day of the build. Repeat-build comparison
// normalizes lastmod further, so only the route set and non-date bytes must match.
const lastmod = new Date().toISOString().slice(0, 10);

await writeFile(
  join(dist, "release-manifest.json"),
  `${JSON.stringify(manifestFor({ universities, posts }), null, 2)}\n`,
  "utf8",
);

// Overwrite any prerender-generated sitemap with the registry/policy set so
// seeds and release validation share one explicit indexable route list.
await writeFile(join(dist, "sitemap.xml"), buildAuthoritativeSitemap(routes, lastmod), "utf8");

await Promise.all([
  rm(join(dist, "pages.json"), { force: true }),
  rm(join(dist, "server"), { recursive: true, force: true }),
]);

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  assertLlmsJoin,
  buildLlmsPacket,
  deriveDiscoveryRoutes,
} from "./llms-packet.mjs";
import { buildRouteLastmod } from "./route-lastmod.mjs";
import { buildRoutes, manifestFor, readRegistry } from "./route-policy.mjs";
import { assertRssJoin, buildRssFeed, RSS_PATH } from "./rss-feed.mjs";
import {
  AGENT_SKILLS_INDEX_PATH,
  assertAgentSkillsIndex,
  assertAgentSkillsRelease,
} from "./agent-skills.mjs";
import {
  API_CATALOG_PATH,
  assertApiCatalogRelease,
} from "./api-catalog.mjs";
import {
  AUTH_BOUNDARY_PATH,
  assertDiscoveryBoundaryRelease,
} from "./discovery-boundaries.mjs";
import {
  buildMarkdownArtifacts,
  assertMarkdownRelease,
  assertUnisMarkdownRegistryJoin,
} from "./markdown-artifacts.mjs";
import { readContentSnapshot } from "./content-snapshot.mjs";
import { buildMarkdownMirrors } from "./markdown-mirrors.mjs";

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

// A sitemap lists pages a crawler should consider indexing. The RSS feed is
// not one: Google crawled it *because* it was listed here and then filed it
// under "crawled – currently not indexed", since a feed has nothing to index.
// It stays discoverable through `<link rel="alternate">` on every page and
// through llms.txt, which is where a feed belongs.
function buildAuthoritativeSitemap(routes, { lastmodByRoute }) {
  // Dates come from post records (blog) or git (everything else) — never from
  // the build day, which the daily cron rebuild turned into a nightly claim
  // that all 32 non-blog pages had changed. See scripts/route-lastmod.mjs.
  // A route with no provable date ships without <lastmod> rather than a guess.
  const body = routes
    .map((route) => {
      const lastmod = lastmodByRoute.get(route);
      const stamp = lastmod ? `<lastmod>${lastmod}</lastmod>` : "";
      return `  <url><loc>${CANONICAL_ORIGIN}${route}</loc>${stamp}</url>`;
    })
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

const { universities, posts, postRecords, affiliationBoundary } = await readRegistry();
const mirrors = buildMarkdownMirrors(readContentSnapshot(root));
const markdownArtifacts = buildMarkdownArtifacts(mirrors);
const routes = buildRoutes({ universities, posts });
const rss = buildRssFeed(postRecords);
assertRssJoin(rss, postRecords);
await writeFile(join(dist, RSS_PATH.replace(/^\//, "")), rss, "utf8");
const discoveryRoutes = deriveDiscoveryRoutes({
  routes: [...routes, RSS_PATH, "/sitemap.xml"],
});
const llms = buildLlmsPacket(universities, { affiliationBoundary, discoveryRoutes });
assertLlmsJoin(llms, universities, { affiliationBoundary, discoveryRoutes });
await writeFile(join(dist, "llms.txt"), llms, "utf8");
const apiCatalogPath = API_CATALOG_PATH.replace(/^\/+/, "");
await mkdir(dirname(join(dist, apiCatalogPath)), { recursive: true });
await copyFile(join(root, "public", apiCatalogPath), join(dist, apiCatalogPath));
const authBoundaryPath = AUTH_BOUNDARY_PATH.replace(/^\/+/, "");
await copyFile(join(root, "public", authBoundaryPath), join(dist, authBoundaryPath));
// Blog surfaces date themselves from the post records; every other route asks
// git when its sources last changed, and omits lastmod when git cannot answer.
// Repeat-build comparison normalizes lastmod further, so only the route set
// and non-date bytes must match.
const lastmodByRoute = buildRouteLastmod({ routes, postRecords, root });

const agentSkillsIndexSource = join(
  root,
  "public",
  AGENT_SKILLS_INDEX_PATH.replace(/^\//, ""),
);
const agentSkillsIndex = JSON.parse(await readFile(agentSkillsIndexSource, "utf8"));
const agentSkillsBytesByUrl = new Map();
for (const entry of agentSkillsIndex.skills ?? []) {
  const artifactPath = new URL(entry.url).pathname.replace(/^\/+/, "");
  agentSkillsBytesByUrl.set(
    entry.url,
    await readFile(join(root, "public", artifactPath)),
  );
}
assertAgentSkillsIndex(agentSkillsIndex, agentSkillsBytesByUrl);
await mkdir(
  dirname(join(dist, AGENT_SKILLS_INDEX_PATH.replace(/^\//, ""))),
  { recursive: true },
);
await writeFile(
  join(dist, AGENT_SKILLS_INDEX_PATH.replace(/^\//, "")),
  await readFile(agentSkillsIndexSource),
);
for (const entry of agentSkillsIndex.skills) {
  const artifactPath = new URL(entry.url).pathname.replace(/^\/+/, "");
  const destination = join(dist, artifactPath);
  await mkdir(join(destination, ".."), { recursive: true });
  await copyFile(join(root, "public", artifactPath), destination);
}
for (const entry of markdownArtifacts) {
  const destination = join(dist, entry.path);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(root, "public", entry.path), destination);
}
// The catalogue mirror is generated, but from a snapshot taken before this
// build. Re-join it to the registry here so a mirror left uncommitted after a
// registry change fails the build rather than shipping a stale catalogue.
assertUnisMarkdownRegistryJoin(
  await readFile(join(dist, "unis.md"), "utf8"),
  universities,
  "dist/unis.md",
);
await assertAgentSkillsRelease({ root, dist });
await assertApiCatalogRelease({ root, dist });
await assertDiscoveryBoundaryRelease({ root, dist });
await assertMarkdownRelease({
  root,
  dist,
  manifest: markdownArtifacts,
});

await writeFile(
  join(dist, "release-manifest.json"),
  `${JSON.stringify(manifestFor({ universities, posts, mirrors }), null, 2)}\n`,
  "utf8",
);

// Overwrite any prerender-generated sitemap with the registry/policy set so
// seeds and release validation share one explicit indexable route list.
await writeFile(
  join(dist, "sitemap.xml"),
  buildAuthoritativeSitemap(routes, { lastmodByRoute }),
  "utf8",
);

await Promise.all([
  rm(join(dist, "pages.json"), { force: true }),
  rm(join(dist, "server"), { recursive: true, force: true }),
]);

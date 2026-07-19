/**
 * Regenerate public/llms.txt from the university registry.
 * Run: node scripts/generate-llms.mjs
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assertLlmsJoin, buildLlmsPacket, deriveDiscoveryRoutes } from "./llms-packet.mjs";
import { buildRoutes, readRegistry } from "./route-policy.mjs";
import { RSS_PATH } from "./rss-feed.mjs";

const root = process.cwd();
const { universities, posts, affiliationBoundary } = await readRegistry(root);
const discoveryRoutes = deriveDiscoveryRoutes({
  routes: [...buildRoutes({ universities, posts }), RSS_PATH, "/sitemap.xml"],
});
const body = buildLlmsPacket(universities, { affiliationBoundary, discoveryRoutes });
assertLlmsJoin(body, universities, { affiliationBoundary, discoveryRoutes });

const target = join(root, "public/llms.txt");
await writeFile(target, body, "utf8");
console.log(
  `Wrote ${target} with ${universities.filter((u) => u.slug).length} registry detail URLs.`,
);

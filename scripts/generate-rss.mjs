/**
 * Regenerate public/blog/rss.xml from the blog content source.
 * Run: node scripts/generate-rss.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assertRssJoin, buildRssFeed, RSS_PATH } from "./rss-feed.mjs";
import { readRegistry } from "./route-policy.mjs";

const root = process.cwd();
const { postRecords } = await readRegistry(root);
const body = buildRssFeed(postRecords);
assertRssJoin(body, postRecords);
const target = join(root, "public", RSS_PATH.replace(/^\//, ""));
await mkdir(join(root, "public/blog"), { recursive: true });
await writeFile(target, body, "utf8");
console.log(`Wrote ${target} with ${postRecords.length} blog posts.`);

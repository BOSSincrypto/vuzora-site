/**
 * Regenerate public/llms.txt from the university registry.
 * Run: node scripts/generate-llms.mjs
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildLlmsPacket, assertLlmsJoin } from "./llms-packet.mjs";
import { readRegistry } from "./route-policy.mjs";

const root = process.cwd();
const { universities, affiliationBoundary } = await readRegistry(root);
const body = buildLlmsPacket(universities, { affiliationBoundary });
assertLlmsJoin(body, universities, { affiliationBoundary });

const target = join(root, "public/llms.txt");
await writeFile(target, body, "utf8");
console.log(
  `Wrote ${target} with ${universities.filter((u) => u.slug).length} registry detail URLs.`,
);

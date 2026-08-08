/**
 * Regenerate the Markdown mirrors under `public/`.
 * Run: node scripts/generate-markdown-mirrors.mjs
 *
 * The mirrors are committed, like `public/llms.txt` and `public/blog/rss.xml`:
 * the release copies them, and `scripts/markdown-mirrors.test.mjs` fails when
 * a committed file no longer matches what this script produces.
 */
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { readContentSnapshot } from "./content-snapshot.mjs";
import { buildMarkdownMirrors } from "./markdown-mirrors.mjs";
import { STATIC_MARKDOWN_ARTIFACTS } from "./markdown-artifacts.mjs";

const root = process.cwd();
const publicRoot = join(root, "public");

async function markdownFilesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFilesUnder(path)));
    else if (/\.md$/i.test(entry.name)) files.push(path);
  }
  return files;
}

const snapshot = readContentSnapshot(root);
const mirrors = buildMarkdownMirrors(snapshot);

for (const mirror of mirrors) {
  const destination = join(publicRoot, mirror.path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, mirror.body, "utf8");
}

// A removed university or post must take its mirror with it, or the release
// manifest and the `public/` inventory disagree and the build fails with a
// message about a file nobody remembers adding.
const kept = new Set([
  ...mirrors.map((mirror) => mirror.path),
  ...STATIC_MARKDOWN_ARTIFACTS.map((entry) => entry.path),
]);
const stale = (await markdownFilesUnder(publicRoot))
  .map((path) => relative(publicRoot, path).split("\\").join("/"))
  .filter((path) => !kept.has(path));
for (const path of stale) await rm(join(publicRoot, path), { force: true });

console.log(
  `Wrote ${mirrors.length} Markdown mirrors to public/` +
    (stale.length ? `, removed ${stale.length} stale file(s): ${stale.join(", ")}` : "."),
);

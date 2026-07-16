import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const [leftRoot, rightRoot] = process.argv.slice(2);
if (!leftRoot || !rightRoot) {
  console.error("Usage: node scripts/compare-release.mjs <first-dist> <second-dist>");
  process.exit(1);
}

async function files(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(path, root)));
    else result.push(relative(root, path));
  }
  return result.sort();
}

function normalize(path, content) {
  if (path !== "sitemap.xml") return content;
  return content.replace(/(<lastmod>)\d{4}-\d{2}-\d{2}(<\/lastmod>)/g, "$1NORMALIZED_LASTMOD$2");
}

async function digest(root, path) {
  const content = normalize(path, await readFile(join(root, path), "utf8"));
  return createHash("sha256").update(content).digest("hex");
}

const [leftFiles, rightFiles] = await Promise.all([files(leftRoot), files(rightRoot)]);
if (JSON.stringify(leftFiles) !== JSON.stringify(rightFiles)) {
  console.error("Release artifact inventories differ:");
  console.error(`first:  ${leftFiles.join(", ")}`);
  console.error(`second: ${rightFiles.join(", ")}`);
  process.exit(1);
}
for (const path of leftFiles) {
  const [leftHash, rightHash] = await Promise.all([
    digest(leftRoot, path),
    digest(rightRoot, path),
  ]);
  if (leftHash !== rightHash) {
    console.error(`Release artifact differs after sitemap lastmod normalization: ${path}`);
    process.exit(1);
  }
}
console.log(
  `Release artifacts are equivalent across ${leftFiles.length} files; only sitemap lastmod normalization was allowed.`,
);

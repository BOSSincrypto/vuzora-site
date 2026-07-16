import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

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

const LASTMOD_OPEN = new TextEncoder().encode("<lastmod>");
const LASTMOD_CLOSE = new TextEncoder().encode("</lastmod>");
const NORMALIZED_LASTMOD = new TextEncoder().encode("NORMALIZED_LASTMOD");

function bytesAt(source, needle, offset) {
  return needle.every((byte, index) => source[offset + index] === byte);
}

export function normalizeSitemapLastmodBytes(path, bytes) {
  if (path !== "sitemap.xml") return bytes;
  const normalized = [];
  let cursor = 0;
  while (cursor < bytes.length) {
    if (
      bytesAt(bytes, LASTMOD_OPEN, cursor) &&
      bytesAt(bytes, LASTMOD_CLOSE, cursor + LASTMOD_OPEN.length + 10) &&
      /^\d{4}-\d{2}-\d{2}$/.test(
        new TextDecoder().decode(
          bytes.slice(cursor + LASTMOD_OPEN.length, cursor + LASTMOD_OPEN.length + 10),
        ),
      )
    ) {
      normalized.push(...bytes.slice(cursor, cursor + LASTMOD_OPEN.length), ...NORMALIZED_LASTMOD);
      cursor += LASTMOD_OPEN.length + 10;
      continue;
    }
    normalized.push(bytes[cursor]);
    cursor += 1;
  }
  return Uint8Array.from(normalized);
}

export function hashReleaseBytes(path, bytes) {
  return createHash("sha256").update(normalizeSitemapLastmodBytes(path, bytes)).digest("hex");
}

async function digest(root, path) {
  return hashReleaseBytes(path, await readFile(join(root, path)));
}

export async function compareReleaseDirectories(leftRoot, rightRoot) {
  const [leftFiles, rightFiles] = await Promise.all([files(leftRoot), files(rightRoot)]);
  if (JSON.stringify(leftFiles) !== JSON.stringify(rightFiles)) {
    throw new Error(
      `Release artifact inventories differ:\nfirst:  ${leftFiles.join(", ")}\nsecond: ${rightFiles.join(", ")}`,
    );
  }
  for (const path of leftFiles) {
    const [leftHash, rightHash] = await Promise.all([
      digest(leftRoot, path),
      digest(rightRoot, path),
    ]);
    if (leftHash !== rightHash)
      throw new Error(`Release artifact differs after sitemap lastmod normalization: ${path}`);
  }
  return leftFiles.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [leftRoot, rightRoot] = process.argv.slice(2);
  if (!leftRoot || !rightRoot) {
    console.error("Usage: node scripts/compare-release.mjs <first-dist> <second-dist>");
    process.exit(1);
  }
  try {
    const count = await compareReleaseDirectories(leftRoot, rightRoot);
    console.log(
      `Release artifacts are equivalent across ${count} files; only sitemap lastmod normalization was allowed.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");

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

// TanStack serializes a wall-clock `updatedAt` into every prerendered hydration
// payload. It is cache metadata, not page content, so freeze it for reproducible
// Pages artifacts while the client still refreshes it after hydration.
for (const path of await htmlFiles(dist)) {
  const html = await readFile(path, "utf8");
  const normalized = html.replace(/u:\d{13}/g, "u:0");
  if (normalized !== html) await writeFile(path, normalized);
}

await Promise.all([
  rm(join(dist, "pages.json"), { force: true }),
  rm(join(dist, "server"), { recursive: true, force: true }),
]);

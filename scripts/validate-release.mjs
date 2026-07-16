import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";
import { artifactFor, buildRoutes, manifestFor, readRegistry } from "./route-policy.mjs";

const root = process.cwd();
const dist = join(root, "dist");
const failures = [];
const fail = (message) => failures.push(message);
const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};
const read = (path) => readFile(path, "utf8");
const { universities, posts } = await readRegistry();
const routes = buildRoutes({ universities, posts });
const expectedManifest = manifestFor({ universities, posts });

const slugSet = new Set();
for (const university of universities) {
  if (university.slug) {
    if (!/^[a-z0-9-]+$/.test(university.slug)) fail(`invalid university slug: ${university.slug}`);
    if (slugSet.has(university.slug)) fail(`duplicate university slug: ${university.slug}`);
    slugSet.add(university.slug);
  }
  if (!university.name || !university.city || !/^(online|soon)$/.test(university.status ?? "")) {
    fail(`incomplete university registry record: ${university.slug ?? university.code}`);
  }
}

if (!(await exists(dist))) fail("missing dist directory");
const manifestPath = join(dist, "release-manifest.json");
if (await exists(manifestPath)) {
  try {
    const actualManifest = JSON.parse(await read(manifestPath));
    if (JSON.stringify(actualManifest) !== JSON.stringify(expectedManifest)) {
      fail("dist/release-manifest.json disagrees with the source registries");
    }
  } catch (error) {
    fail(`invalid dist/release-manifest.json: ${error.message}`);
  }
}

const routeArtifacts = new Set();
for (const route of routes) {
  const artifact = join(dist, artifactFor(route));
  routeArtifacts.add(relative(dist, artifact));
  if (!(await exists(artifact))) {
    fail(`missing route artifact: ${route} -> ${relative(root, artifact)}`);
    continue;
  }
  const html = await read(artifact);
  if (!/^<!doctype html>/i.test(html)) fail(`invalid HTML doctype: ${route}`);
  if ((html.match(/<h1\b/gi) ?? []).length !== 1) fail(`expected one H1: ${route}`);
  if (!/<title>[^<]+<\/title>/i.test(html)) fail(`missing title: ${route}`);
  if (route.startsWith("/unis/") && !html.includes("data-university-detail")) {
    fail(`university detail marker missing: ${route}`);
  }
}

if (await exists(dist)) {
  const htmlArtifacts = [];
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith(".html")) htmlArtifacts.push(relative(dist, path));
    }
  };
  await walk(dist);
  const unexpected = htmlArtifacts.filter((artifact) => artifact !== "404.html" && !routeArtifacts.has(artifact));
  if (unexpected.length) fail(`unexpected route HTML artifacts: ${unexpected.join(", ")}`);
}

for (const file of ["CNAME", ".nojekyll", "404.html", "robots.txt", "sitemap.xml"]) {
  if (!(await exists(join(dist, file)))) fail(`missing release artifact: dist/${file}`);
}
if (await exists(join(dist, "CNAME"))) {
  const cname = await read(join(dist, "CNAME"));
  if (cname !== "vuzora.ru\n") fail("dist/CNAME must contain exactly one vuzora.ru line");
}
if (await exists(join(dist, ".nojekyll"))) {
  const nojekyll = await readFile(join(dist, ".nojekyll"));
  if (nojekyll.length !== 0) fail("dist/.nojekyll must be empty");
}
if (await exists(join(dist, "release-manifest.json"))) fail("release manifest must not be uploaded");
if (await exists(join(dist, "pages.json"))) fail("dist/pages.json must not be uploaded");
if (await exists(join(dist, "server"))) fail("dist/server must not be uploaded");
if (await exists(join(dist, "404.html"))) {
  const notFound = await read(join(dist, "404.html"));
  if ((notFound.match(/<h1\b/gi) ?? []).length !== 1) fail("404.html must contain exactly one H1");
  if (!/<a\b[^>]+href="\//i.test(notFound)) fail("404.html must link to /");
  if (/Vuzora\s*[–-]\s*расписание вуза/i.test(notFound)) fail("404.html leaks homepage identity");
  for (const university of universities) {
    if (university.name && notFound.includes(university.name)) {
      fail(`404.html leaks university identity: ${university.name}`);
    }
  }
}
if (await exists(join(dist, "robots.txt"))) {
  const robots = await read(join(dist, "robots.txt"));
  if ((robots.match(/^Sitemap:\s*https:\/\/vuzora\.ru\/sitemap\.xml$/gim) ?? []).length !== 1) {
    fail("robots.txt must expose exactly one canonical sitemap directive");
  }
}
if (await exists(join(dist, "sitemap.xml"))) {
  const sitemap = await read(join(dist, "sitemap.xml"));
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const expected = new Set(routes.map((route) => `https://vuzora.ru${route}`));
  const actual = new Set(locs);
  if (locs.length !== actual.size) fail("sitemap.xml contains duplicate loc entries");
  if (locs.some((loc) => !loc.startsWith("https://vuzora.ru/") || loc.includes("#") || loc.includes("?"))) {
    fail("sitemap.xml contains a non-canonical locator");
  }
  if (expected.size !== actual.size || [...expected].some((loc) => !actual.has(loc))) {
    fail(`sitemap route set mismatch: expected ${expected.size}, found ${actual.size}`);
  }
}

if (failures.length) {
  console.error("Release validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Release validation passed for ${routes.length} registry-derived routes and required Pages artifacts.`);

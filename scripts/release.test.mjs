import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { artifactFor, buildRoutes, readRegistry } from "./route-policy.mjs";

const root = process.cwd();
const read = (path) => readFile(join(root, path), "utf8");

test("release configuration pins static prerendering and fails on errors", async () => {
  const config = await read("vite.config.ts");
  assert.equal(await read(".bun-version"), "1.3.14\n");
  assert.match(await read("package.json"), /"packageManager":\s*"bun@1\.3\.14"/);
  assert.match(config, /prerender:\s*\{/);
  assert.match(config, /enabled:\s*true/);
  assert.match(config, /failOnError:\s*true/);
  assert.match(config, /crawlLinks:\s*false/);
  assert.match(config, /nitro:\s*false/);
  assert.match(config, /outDir:\s*["']dist["']/);
  assert.match(await read("package.json"), /scripts[\s\S]*build[\s\S]*prepare-release/);
  assert.match(await read("scripts/prepare-release.mjs"), /u:\\d\{13\}/);
});

test("prerender seeds derive the complete public route policy", async () => {
  const config = await read("vite.config.ts");
  const { universities, posts } = await readRegistry();
  const routes = buildRoutes({ universities, posts });
  assert.match(config, /PRERENDER_ROUTES\.map\(\(path\) => \(\{ path \}\)\)/);
  assert.deepEqual(routes.slice(0, 7), [
    "/",
    "/pricing",
    "/unis",
    "/blog/",
    "/changelog",
    "/legal/terms",
    "/legal/privacy",
  ]);
  assert.equal(
    routes.filter((route) => route.startsWith("/unis/")).length,
    universities.filter((university) => university.slug).length,
  );
  assert.equal(artifactFor("/blog/"), "blog/index.html");
});

test("Pages workflow runs every gate before upload", async () => {
  const workflow = await read(".github/workflows/deploy.yml");
  assert.match(workflow, /bun-version:\s*["']1\.3\.14["']/);
  const buildPosition = workflow.indexOf("run: bun run build");
  const uploadPosition = workflow.indexOf("actions/upload-pages-artifact");
  for (const gate of ["typecheck", "lint", "test", "build", "validate:release"]) {
    assert.ok(workflow.indexOf(`bun run ${gate}`) < uploadPosition, `${gate} must precede upload`);
  }
  assert.ok(buildPosition < uploadPosition);
  assert.match(workflow, /needs:\s*build/);
});

test("Pages release artifacts have independent 404 and nojekyll sources", async () => {
  const notFound = await read("public/404.html");
  const nojekyll = await read("public/.nojekyll");
  assert.match(notFound, /<h1>[^<]+<\/h1>/i);
  assert.match(notFound, /href="\/"/);
  assert.equal(nojekyll, "");
  assert.doesNotMatch(notFound, /Vuzora\s*[–-]\s*расписание вуза/i);
});

test("canonical sitemap policy is exposed by robots", async () => {
  const robots = await read("public/robots.txt");
  assert.equal(
    (robots.match(/^Sitemap:\s*https:\/\/vuzora\.ru\/sitemap\.xml$/gim) ?? []).length,
    1,
  );
  assert.doesNotMatch(robots, /plausible|google-analytics|metrika/i);
});

test("current registry, content, and Telegram destinations stay explicit", async () => {
  const universities = await read("src/content/universities.ts");
  const site = await read("src/content/site.ts");
  const sitemap = await read("src/routes/sitemap[.]xml.tsx");
  assert.match(universities, /"online"\s*\|\s*"soon"/);
  assert.match(universities, /status: "online"/);
  assert.match(universities, /slug:\s*"[a-z0-9-]+"/);
  assert.match(universities, /export function findUniversity/);
  assert.match(universities, /universityBotUrl/);
  assert.match(site, /botUrl:\s*"https:\/\/t\.me\/vuzora_bot"/);
  assert.match(site, /supportBotUrl:\s*"https:\/\/t\.me\/vuzora_support_bot"/);
  assert.match(site, /genericBotUrl:\s*"https:\/\/t\.me\/vuzora_bot\?start=from-site"/);
  assert.match(sitemap, /path: "\/blog\/"/);
  assert.match(sitemap, /UNIVERSITIES\.map|universityPagePath/);
  assert.doesNotMatch(sitemap, /fallback|status:\s*200/);
});

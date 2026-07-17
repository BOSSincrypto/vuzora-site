import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  artifactFor,
  buildRoutes,
  readRegistry,
} from "./route-policy.mjs";
import {
  assertBlogIndexJoin,
  assertEditorialGraph,
} from "./editorial-joins.mjs";
import { parseHtmlDocument, validateRelease } from "./release-validator.mjs";

const root = process.cwd();

async function readEditorialDocuments(base = root) {
  const { universities, postRecords } = await readRegistry(base);
  const routes = buildRoutes({ universities, posts: postRecords.map((post) => post.slug) });
  const documents = new Map();
  for (const route of routes) {
    documents.set(
      route,
      parseHtmlDocument(await readFile(join(base, "dist", artifactFor(route)), "utf8")),
    );
  }
  return { documents, universities, postRecords };
}

test("editorial index and graph join all committed post artifacts", async () => {
  const { documents, universities, postRecords } = await readEditorialDocuments();
  const indexResult = assertBlogIndexJoin(documents.get("/blog/"), postRecords);
  assert.equal(indexResult.foundCount, postRecords.length);
  const graphResult = assertEditorialGraph({ documents, posts: postRecords, universities });
  assert.equal(graphResult.universityCount, universities.length);
  assert.equal(graphResult.focusedPostSlugs.length, 10);
});

test("editorial index join fails closed on missing or phantom post links", async () => {
  const { documents, postRecords } = await readEditorialDocuments();
  const index = documents.get("/blog/");
  const missing = {
    ...index,
    anchors: index.anchors.map((anchor) =>
      anchor.href === "/blog/chto-budet-posle-31-oktyabrya"
        ? { ...anchor, href: "/blog/not-a-real-post" }
        : anchor,
    ),
  };
  assert.throws(() => assertBlogIndexJoin(missing, postRecords), /blog index post links set mismatch/);
});

test("validate:release rejects editorial index and hub drift", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "vuzora-editorial-"));
  try {
    await cp(root, fixtureRoot, {
      recursive: true,
      filter: (source) => !source.includes("node_modules"),
    });
    const indexPath = join(fixtureRoot, "dist/blog/index.html");
    const hubPath = join(fixtureRoot, "dist/blog/raspisanie-vuzov-v-telegram/index.html");
    const originalIndex = await readFile(indexPath, "utf8");
    const originalHub = await readFile(hubPath, "utf8");

    await writeFile(
      indexPath,
      originalIndex.replace(
        'href="/blog/chto-budet-posle-31-oktyabrya"',
        'href="/blog/not-a-real-post"',
      ),
      "utf8",
    );
    await assert.rejects(
      () => validateRelease({ root: fixtureRoot, dist: join(fixtureRoot, "dist") }),
      /Editorial blog index:.*set mismatch/,
    );

    await writeFile(indexPath, originalIndex, "utf8");
    await writeFile(
      hubPath,
      originalHub.replace('href="/unis/reu-plekhanov"', 'href="/unis/not-a-real-university"'),
      "utf8",
    );
    await assert.rejects(
      () => validateRelease({ root: fixtureRoot, dist: join(fixtureRoot, "dist") }),
      /Editorial graph:.*set mismatch/,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("validate:release rejects sitemap omissions for committed posts", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "vuzora-sitemap-"));
  try {
    await cp(root, fixtureRoot, {
      recursive: true,
      filter: (source) => !source.includes("node_modules"),
    });
    const sitemapPath = join(fixtureRoot, "dist/sitemap.xml");
    const sitemap = await readFile(sitemapPath, "utf8");
    const postLoc = "https://vuzora.ru/blog/raspisanie-vuzov-v-telegram";
    await writeFile(
      sitemapPath,
      sitemap.replace(
        new RegExp(`\\s*<url><loc>${postLoc}</loc><lastmod>[^<]+</lastmod></url>`),
        "",
      ),
      "utf8",
    );
    await assert.rejects(
      () => validateRelease({ root: fixtureRoot, dist: join(fixtureRoot, "dist") }),
      /sitemap route set mismatch/,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

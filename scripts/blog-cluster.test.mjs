import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { readRegistry } from "./route-policy.mjs";
import { FOCUSED_POST_MAX, FOCUSED_POST_MIN } from "./editorial-joins.mjs";

const root = process.cwd();
const read = (path) => readFile(join(root, path), "utf8");

function readBlogPosts(source) {
  return [...source.matchAll(/\{\s*slug:\s*"([^"]+)"[\s\S]*?body:\s*\[([\s\S]*?)\n\s*\],\s*\n\s*\},/g)].map(
    (match) => ({
      slug: match[1],
      universitySlug:
        source
          .slice(match.index, match.index + match[0].length)
          .match(/\buniversitySlug:\s*"([^"]+)"/)?.[1] ?? null,
      body: [...match[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((item) =>
        JSON.parse(`"${item[1]}"`),
      ),
    }),
  );
}

function internalLinks(body) {
  return [...body.matchAll(/\[\[([^|\]]+)\|[^\]]+\]\]/g)].map((match) => match[1]);
}

function normalizedWords(body, universities) {
  let value = body
    .replace(/\[\[[^|\]]+\|[^\]]+\]\]/g, " INTERNAL_LINK ")
    .toLowerCase();
  for (const university of universities) {
    for (const identity of [university.name, university.code]) {
      value = value.replaceAll(identity.toLowerCase(), " UNIVERSITY ");
    }
  }
  return new Set(value.match(/[а-яёa-z0-9]+/gi) ?? []);
}

function jaccard(left, right) {
  const intersection = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 1 : intersection / union;
}

test("editorial cluster has one complete hub and ten focused posts", async () => {
  const [source, { universities }] = await Promise.all([
    read("src/content/blog.ts"),
    readRegistry(root),
  ]);
  const posts = readBlogPosts(source);
  const bySlug = new Map(posts.map((post) => [post.slug, post]));
  const hub = bySlug.get("raspisanie-vuzov-v-telegram");
  const focused = posts.filter((post) => post.universitySlug);
  const focusedPairs = focused.map((post) => [post.slug, post.universitySlug]);

  assert.ok(hub, "hub post is present");
  assert.equal(posts.filter((post) => post.slug === hub.slug).length, 1);
  assert.ok(focused.length >= FOCUSED_POST_MIN && focused.length <= FOCUSED_POST_MAX);
  assert.deepEqual(
    focused.map((post) => post.slug).sort(),
    posts
      .filter((post) => post.universitySlug)
      .map((post) => post.slug)
      .sort(),
  );

  const hubLinks = internalLinks(hub.body.join(" "));
  const expectedUniversityLinks = universities.map((university) => `/unis/${university.slug}`);
  assert.equal(new Set(hubLinks).size, hubLinks.length);
  assert.deepEqual(
    hubLinks.filter((href) => href.startsWith("/unis/")).sort(),
    expectedUniversityLinks.sort(),
  );
  assert.deepEqual(
    hubLinks.filter((href) => href.startsWith("/blog/")).sort(),
    focused.map((post) => `/blog/${post.slug}`).sort(),
  );

  for (const [postSlug, universitySlug] of focusedPairs) {
    const post = bySlug.get(postSlug);
    assert.ok(post, `${postSlug} is present`);
    const links = internalLinks(post.body.join(" "));
    assert.equal(links.filter((href) => href === "/blog/raspisanie-vuzov-v-telegram").length, 1);
    assert.equal(links.filter((href) => href === `/unis/${universitySlug}`).length, 1);
  }
});

test("focused editorial bodies are distinct after identity normalization", async () => {
  const [source, { universities }] = await Promise.all([
    read("src/content/blog.ts"),
    readRegistry(root),
  ]);
  const posts = new Map(readBlogPosts(source).map((post) => [post.slug, post]));
  const focused = [...posts.values()].filter((post) => post.universitySlug);
  const bodies = focused.map((post) => normalizedWords(post.body.join(" "), universities));

  assert.equal(new Set(bodies.map((words) => [...words].sort().join(" "))).size, focused.length);
  for (let left = 0; left < bodies.length; left += 1) {
    for (let right = left + 1; right < bodies.length; right += 1) {
      assert.ok(
        jaccard(bodies[left], bodies[right]) < 0.82,
        `focused posts ${focused[left].slug} and ${focused[right].slug} are too similar`,
      );
    }
  }
});

test("all blog posts participate in static prerender route generation", async () => {
  const [publicRoutes, policy] = await Promise.all([
    read("src/content/public-routes.ts"),
    read("scripts/route-policy.mjs"),
  ]);
  assert.match(publicRoutes, /const BLOG_ROUTES = POSTS\.map/);
  assert.match(publicRoutes, /PRERENDER_ROUTES = \[\.\.\.CORE_ROUTES, \.\.\.BLOG_ROUTES/);
  assert.match(policy, /const blog = posts\.map\(\(slug\) => `\/blog\/\$\{slug\}`\)/);
});

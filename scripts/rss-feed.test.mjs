import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { readRegistry } from "./route-policy.mjs";
import {
  assertRssJoin,
  buildRssFeed,
  extractRssPostUrls,
  RSS_PATH,
  RSS_URL,
} from "./rss-feed.mjs";

const root = process.cwd();
const read = (path) => readFile(join(root, path), "utf8");

const fixturePosts = [
  {
    slug: "first-post",
    title: "Первый пост",
    date: "2026-07-01",
    summary: "Короткое описание",
    body: ["Текст публикации."],
  },
  {
    slug: "second-post",
    title: "Второй пост & заметка",
    date: "2026-06-01",
    summary: "Еще одно описание",
    body: ["Продолжение."],
  },
];

test("RSS builder emits well-formed RSS 2.0 with canonical item metadata", () => {
  const feed = buildRssFeed(fixturePosts);
  assert.match(feed, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(feed, /<rss version="2\.0">/);
  assert.match(feed, /<channel>[\s\S]*<\/channel>/);
  assert.equal((feed.match(/<item>/g) ?? []).length, fixturePosts.length);
  assert.match(feed, new RegExp(`${RSS_URL}/?`));
  assert.deepEqual(
    extractRssPostUrls(feed).map((entry) => entry.slug),
    fixturePosts.map((post) => post.slug),
  );
  assert.doesNotMatch(feed, /Второй пост & заметка/);
  assert.match(feed, /Второй пост &amp; заметка/);
  assertRssJoin(feed, fixturePosts);
});

test("RSS join covers every committed blog post", async () => {
  const { posts: postSlugs, postRecords } = await readRegistry(root);
  const posts = postRecords;
  assert.equal(posts.length, postSlugs.length);
  const feed = buildRssFeed(posts);
  const result = assertRssJoin(feed, posts);
  assert.equal(result.expectedCount, posts.length);
  assert.equal(result.foundCount, posts.length);
  assert.equal(RSS_PATH, "/blog/rss.xml");
  const artifact = await read("public/blog/rss.xml");
  assert.equal(artifact, feed);
});

test("RSS join fails closed on underlist and overlist", () => {
  const full = buildRssFeed(fixturePosts);
  assert.throws(() => assertRssJoin(full, [...fixturePosts, { slug: "missing" }]), /underlist|mismatch/i);
  const phantom = buildRssFeed([
    ...fixturePosts,
    {
      slug: "phantom-post",
      title: "Неизвестный пост",
      date: "2026-05-01",
      summary: "Фантом",
      body: ["Не должен пройти."],
    },
  ]);
  assert.throws(() => assertRssJoin(phantom, fixturePosts), /overlist|phantom|count mismatch/i);
});

test("RSS join fails closed on missing, malformed, insecure, and duplicate items", () => {
  assert.throws(() => assertRssJoin("", fixturePosts), /empty|missing/i);
  assert.throws(() => assertRssJoin("<rss version=\"2.0\"><channel /></rss>", fixturePosts), /encoding/i);
  const full = buildRssFeed(fixturePosts);
  assert.throws(
    () => assertRssJoin(full.replace("https://vuzora.ru/blog/first-post", "/blog/first-post"), fixturePosts),
    /non-canonical/i,
  );
  assert.throws(
    () => assertRssJoin(full.replace("https://vuzora.ru/blog/second-post", "https://vuzora.ru/blog/first-post"), fixturePosts),
    /duplicate/i,
  );
  assert.throws(
    () => assertRssJoin(full.replace("</item>", "</channel>"), fixturePosts),
    /XML|mismatch|incomplete/i,
  );
  assert.throws(
    () => assertRssJoin(full.replace("<title>Первый пост</title>", "<title>Подмененный пост</title>"), fixturePosts),
    /title mismatch/i,
  );
});

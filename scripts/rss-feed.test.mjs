import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { readRegistry } from "./route-policy.mjs";
import {
  assertRssJoin,
  buildRssFeed,
  dateToRfc822,
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
  assert.match(feed, /<link>https:\/\/vuzora\.ru\/blog\/first-post\/<\/link>/);
  assert.doesNotMatch(feed, /<link>https:\/\/vuzora\.ru\/blog\/first-post<\/link>/);
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
    () => assertRssJoin(full.replace("https://vuzora.ru/blog/first-post/", "/blog/first-post"), fixturePosts),
    /non-canonical/i,
  );
  assert.throws(
    () => assertRssJoin(full.replace("https://vuzora.ru/blog/second-post/", "https://vuzora.ru/blog/first-post/"), fixturePosts),
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

test("RSS join requires authoritative RFC822 publication dates", () => {
  const full = buildRssFeed(fixturePosts);
  const expectedDate = dateToRfc822(fixturePosts[0].date);
  for (const replacement of ["Tue, 02 Jun 2026 00:00:00 GMT", "not-a-date"]) {
    const mutated = full.replace(
      `<pubDate>${expectedDate}</pubDate>`,
      `<pubDate>${replacement}</pubDate>`,
    );
    assert.notEqual(mutated, full);
    assert.throws(() => assertRssJoin(mutated, fixturePosts), /publication date mismatch/i);
  }
});

test("RSS XML validation rejects malformed text, entities, attributes, declarations, and nesting", () => {
  const full = buildRssFeed(fixturePosts);
  const malformedFixtures = {
    "raw ampersand in text": full.replace("Блог Vuzora", "Блог & Vuzora"),
    "unescaped less-than in text": full.replace("Блог Vuzora", "Блог < Vuzora"),
    "invalid entity": full.replace("Блог Vuzora", "Блог &bogus; Vuzora"),
    "malformed attribute quoting": full.replace(
      'href="https://vuzora.ru/blog/rss.xml"',
      'href="https://vuzora.ru/blog/rss.xml',
    ),
    "adjacent attributes without whitespace": full.replace(
      'rel="self" type="application/rss+xml"',
      'rel="self"type="application/rss+xml"',
    ),
    "unquoted attribute": full.replace('<rss version="2.0">', "<rss version=2.0>"),
    "malformed declaration": full.replace(
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<?xml version="1.0" encoding="UTF-8"',
    ),
    "declaration standalone before encoding": full.replace(
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<?xml version="1.0" standalone="no" encoding="UTF-8"?>',
    ),
    "mismatched tags": full.replace("</item>", "</channel>"),
    "improperly nested tags": full.replace("<title>Первый пост</title>", "<title>Первый пост</description>"),
  };
  for (const [name, malformed] of Object.entries(malformedFixtures)) {
    assert.throws(() => assertRssJoin(malformed, fixturePosts), undefined, name);
  }
  assert.doesNotThrow(() => assertRssJoin(full, fixturePosts));
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';
  assert.doesNotThrow(
    () => assertRssJoin(full.replace('<?xml version="1.0" encoding="UTF-8"?>', declaration), fixturePosts),
    declaration,
  );
});

test("validate:release rejects each malformed RSS release fixture", async () => {
  const { validateRelease } = await import("./release-validator.mjs");
  const valid = await read("dist/blog/rss.xml");
  const malformedFixtures = {
    "raw ampersand": valid.replace("Блог Vuzora", "Блог & Vuzora"),
    "unescaped less-than": valid.replace("Блог Vuzora", "Блог < Vuzora"),
    "invalid entity": valid.replace("Блог Vuzora", "Блог &bogus; Vuzora"),
    "malformed quoting": valid.replace(
      'href="https://vuzora.ru/blog/rss.xml"',
      'href="https://vuzora.ru/blog/rss.xml',
    ),
    "adjacent attributes without whitespace": valid.replace(
      'rel="self" type="application/rss+xml"',
      'rel="self"type="application/rss+xml"',
    ),
    "unquoted attribute": valid.replace('<rss version="2.0">', "<rss version=2.0>"),
    "malformed declaration": valid.replace(
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<?xml version="1.0" encoding="UTF-8"',
    ),
    "declaration standalone before encoding": valid.replace(
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<?xml version="1.0" standalone="no" encoding="UTF-8"?>',
    ),
    "mismatched tags": valid.replace("</item>", "</channel>"),
    "improperly nested tags": valid.replace("<title>Блог Vuzora</title>", "<title>Блог Vuzora</description>"),
    "incorrect publication date": valid.replace(
      /<pubDate>[^<]+<\/pubDate>/,
      "<pubDate>Tue, 02 Jun 2026 00:00:00 GMT</pubDate>",
    ),
  };
  const fixtureRoot = await mkdtemp(join(tmpdir(), "vuzora-rss-"));
  try {
    await cp(root, fixtureRoot, { recursive: true, filter: (source) => !source.includes("node_modules") });
    for (const [name, malformed] of Object.entries(malformedFixtures)) {
      await writeFile(join(fixtureRoot, "dist/blog/rss.xml"), malformed, "utf8");
      await assert.rejects(
        () => validateRelease({ root: fixtureRoot, dist: join(fixtureRoot, "dist") }),
        undefined,
        name,
      );
    }
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

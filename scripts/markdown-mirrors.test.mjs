import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { readContentSnapshot } from "./content-snapshot.mjs";
import { buildMarkdownMirrors, richTextToMarkdown } from "./markdown-mirrors.mjs";
import { assertUnisMarkdownRegistryJoin } from "./markdown-artifacts.mjs";

const root = process.cwd();
const snapshot = readContentSnapshot(root);
const mirrors = buildMarkdownMirrors(snapshot);

test("committed mirrors match what the current content produces", async () => {
  // The whole point of the mirrors is that they cannot disagree with the page.
  // They are committed files, so nothing but this check stands between an
  // edited price and a Markdown twin still quoting the old one.
  const drifted = [];
  for (const mirror of mirrors) {
    const committed = await readFile(join(root, "public", mirror.path), "utf8");
    if (committed !== mirror.body) drifted.push(mirror.path);
  }
  assert.deepEqual(
    drifted,
    [],
    "stale Markdown mirror(s); run: node scripts/generate-markdown-mirrors.mjs",
  );
});

test("every public page has exactly one mirror", () => {
  const expected = [
    "/",
    "/pricing/",
    "/unis/",
    "/changelog/",
    snapshot.blogIndexPath,
    ...snapshot.posts.map((post) => post.path),
    ...snapshot.universities.map((university) => university.path),
    ...snapshot.legal.map((legal) => legal.path),
  ].sort();
  assert.deepEqual([...mirrors.map((mirror) => mirror.route)].sort(), expected);
  assert.equal(new Set(mirrors.map((mirror) => mirror.path)).size, mirrors.length);
});

test("mirrors state the facts a reader gets from the page", () => {
  const byRoute = new Map(mirrors.map((mirror) => [mirror.route, mirror.body]));

  const pricing = byRoute.get("/pricing/");
  // A period and its price have to appear in one text run — the failure the
  // card grid has by construction, and the reason this mirror exists.
  for (const plan of snapshot.pricing.plans) {
    assert.ok(
      pricing.includes(`| ${plan.period} | ${plan.priceLabel} |`),
      `pricing mirror lost the row for ${plan.period}`,
    );
  }
  assert.ok(pricing.includes(snapshot.pricing.refund), "pricing mirror lost the refund rule");

  const terms = byRoute.get("/legal/terms/");
  assert.ok(terms.includes(snapshot.site.legal.inn), "offer mirror lost the operator INN");
  assert.ok(terms.includes(`Редакция от ${snapshot.site.legal.revision}`));

  for (const university of snapshot.universities) {
    const body = byRoute.get(university.path);
    assert.ok(body.includes(university.name), `${university.slug}: registry name missing`);
    assert.ok(body.includes(university.city), `${university.slug}: registry city missing`);
    assert.ok(
      body.includes(snapshot.affiliationBoundary),
      `${university.slug}: affiliation boundary missing`,
    );
    assert.ok(body.includes(university.botUrl), `${university.slug}: bound CTA link missing`);
    if (university.scheduleUrl) {
      assert.ok(
        body.includes(university.scheduleUrl),
        `${university.slug}: official schedule source missing`,
      );
    }
  }

  for (const post of snapshot.posts) {
    const body = byRoute.get(post.path);
    for (const paragraph of post.body) {
      assert.ok(
        body.includes(richTextToMarkdown(paragraph)),
        `${post.slug}: body paragraph missing from the mirror`,
      );
    }
  }
});

test("a university-focused post names its detail page as the primary source", () => {
  const byRoute = new Map(mirrors.map((mirror) => [mirror.route, mirror.body]));
  const focused = snapshot.posts.filter((post) => post.universitySlug);
  assert.ok(focused.length > 0, "expected at least one university-focused post");
  for (const post of focused) {
    const university = snapshot.universities.find((entry) => entry.slug === post.universitySlug);
    assert.ok(university, `${post.slug} targets an unknown university`);
    const body = byRoute.get(post.path);
    assert.ok(
      body.includes(`Основная страница по этому вузу — ${university.name}: ${university.path}`),
      `${post.slug}: mirror does not defer to the university page`,
    );
  }
});

test("no mirror carries authoring markup or raw HTML", () => {
  for (const mirror of mirrors) {
    assert.doesNotMatch(
      mirror.body,
      /\[\[[^\]]*\|/,
      `${mirror.path} kept raw [[href|label]] markup`,
    );
    assert.doesNotMatch(mirror.body, /<[a-z][^>]*>/i, `${mirror.path} contains HTML`);
    assert.match(mirror.body, /^# .+/m, `${mirror.path} has no H1`);
    assert.ok(mirror.body.endsWith("\n"), `${mirror.path} must end with a newline`);
    assert.doesNotMatch(mirror.body, /\n{3,}/, `${mirror.path} has a blank-line run`);
  }
});

test("the catalogue mirror still satisfies the registry join", () => {
  const catalogue = mirrors.find((mirror) => mirror.path === "unis.md");
  assert.ok(catalogue);
  assert.doesNotThrow(() =>
    assertUnisMarkdownRegistryJoin(catalogue.body, snapshot.universities, "generated unis.md"),
  );
  // And the join is real: drop one row and it must fail.
  const withoutFirst = catalogue.body.replace(
    new RegExp(`^- \\*\\*${snapshot.universities[0].code}\\*\\*.*$\\n?`, "m"),
    "",
  );
  assert.throws(() =>
    assertUnisMarkdownRegistryJoin(withoutFirst, snapshot.universities, "generated unis.md"),
  );
});

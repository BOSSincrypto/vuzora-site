import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  MARKDOWN_ARTIFACTS,
  MARKDOWN_MEDIA_TYPE,
  assertMarkdownArtifact,
  assertMarkdownRelease,
} from "./markdown-artifacts.mjs";
import { manifestFor, readRegistry } from "./route-policy.mjs";

const root = process.cwd();

test("release manifest selects explicit, route-identified Markdown artifacts", async () => {
  const { universities, posts } = await readRegistry();
  const manifest = manifestFor({ universities, posts });
  assert.deepEqual(manifest.markdown, MARKDOWN_ARTIFACTS);
  assert.deepEqual(
    manifest.markdown.map(({ path }) => path),
    [
      "auth.md",
      "unis.md",
      ".well-known/agent-skills/public-site-discovery/SKILL.md",
    ],
  );
  assert.ok(manifest.markdown.every((entry) => entry.mediaType === MARKDOWN_MEDIA_TYPE));
  assert.ok(manifest.markdown.every((entry) => entry.route.endsWith(".md") || entry.route.startsWith("/")));
});

test("Markdown artifact validation rejects HTML, binary, unsupported claims, and identity drift", () => {
  const entry = MARKDOWN_ARTIFACTS.find((artifact) => artifact.path === "unis.md");
  assert.ok(entry);
  assert.doesNotThrow(() =>
    assertMarkdownArtifact(
      "# Поддерживаемые вузы – Vuzora\n\nМаршрут: `/unis`.\n",
      entry,
    ),
  );
  const fixtures = [
    ["HTML", "<!doctype html><html><h1>Поддерживаемые вузы – Vuzora</h1></html>"],
    ["binary", "# Поддерживаемые вузы – Vuzora\n\0\nМаршрут: `/unis`."],
    [
      "unsupported API",
      "# Поддерживаемые вузы – Vuzora\n\nМаршрут: `/unis`.\nAPI endpoint: https://vuzora.ru/api.\n",
    ],
    ["identity", "# Каталог\n\nМаршрут: `/unis`.\n"],
  ];
  for (const [label, body] of fixtures) {
    assert.throws(
      () => assertMarkdownArtifact(body, entry),
      /Markdown|HTML|binary|unsupported|identify/,
      label,
    );
  }
});

test("Markdown release validation fails closed on missing, extra, empty, and divergent artifacts", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "vuzora-markdown-artifacts-"));
  try {
    for (const directory of ["public", "dist"]) await mkdir(join(fixtureRoot, directory), { recursive: true });
    for (const entry of MARKDOWN_ARTIFACTS) {
      const source = join(root, "public", entry.path);
      for (const directory of ["public", "dist"]) {
        const destination = join(fixtureRoot, directory, entry.path);
        await mkdir(join(destination, ".."), { recursive: true });
        await cp(source, destination);
      }
    }
    const valid = await assertMarkdownRelease({
      root: fixtureRoot,
      dist: join(fixtureRoot, "dist"),
      manifest: MARKDOWN_ARTIFACTS,
    });
    assert.equal(valid.entries.length, MARKDOWN_ARTIFACTS.length);

    await rm(join(fixtureRoot, "dist", "unis.md"));
    await assert.rejects(
      () =>
        assertMarkdownRelease({
          root: fixtureRoot,
          dist: join(fixtureRoot, "dist"),
          manifest: MARKDOWN_ARTIFACTS,
        }),
      /inventory|matching artifact/,
    );
    await cp(join(root, "public", "unis.md"), join(fixtureRoot, "dist", "unis.md"));

    await writeFile(join(fixtureRoot, "dist", "auth.md"), "", "utf8");
    await assert.rejects(
      () =>
        assertMarkdownRelease({
          root: fixtureRoot,
          dist: join(fixtureRoot, "dist"),
          manifest: MARKDOWN_ARTIFACTS,
        }),
      /empty|differ/,
    );
    await cp(join(root, "public", "auth.md"), join(fixtureRoot, "dist", "auth.md"));

    await writeFile(join(fixtureRoot, "dist", "unlisted.md"), "# Unlisted\n", "utf8");
    await assert.rejects(
      () =>
        assertMarkdownRelease({
          root: fixtureRoot,
          dist: join(fixtureRoot, "dist"),
          manifest: MARKDOWN_ARTIFACTS,
        }),
      /inventory/,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

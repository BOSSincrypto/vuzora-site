import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  MARKDOWN_MEDIA_TYPE,
  STATIC_MARKDOWN_ARTIFACTS,
  assertMarkdownArtifact,
  assertMarkdownRelease,
  buildMarkdownArtifacts,
  markdownMirrorPath,
} from "./markdown-artifacts.mjs";
import { manifestFor, readRegistry } from "./route-policy.mjs";
import { readContentSnapshot } from "./content-snapshot.mjs";
import { buildMarkdownMirrors } from "./markdown-mirrors.mjs";

const root = process.cwd();

/** Every artifact the current content produces: the two boundaries plus one mirror per page. */
const ALL_ARTIFACTS = buildMarkdownArtifacts(buildMarkdownMirrors(readContentSnapshot(root)));

/** The catalogue mirror, used as a stable fixture for the artifact assertions. */
const UNIS_MIRROR_ENTRY = {
  path: "unis.md",
  route: "/unis/",
  identity: "Поддерживаемые вузы – Vuzora",
  mediaType: MARKDOWN_MEDIA_TYPE,
};

test("release manifest lists the hand-written boundaries plus one mirror per page", async () => {
  const { universities, posts } = await readRegistry();
  const mirrors = buildMarkdownMirrors(readContentSnapshot(root));
  const manifest = manifestFor({ universities, posts, mirrors });

  assert.deepEqual(manifest.markdown, buildMarkdownArtifacts(mirrors));
  // Every public page, and nothing else, plus the two hand-written documents.
  assert.equal(manifest.markdown.length, mirrors.length + STATIC_MARKDOWN_ARTIFACTS.length);
  for (const entry of STATIC_MARKDOWN_ARTIFACTS) {
    assert.ok(manifest.markdown.some((candidate) => candidate.path === entry.path), entry.path);
  }
  for (const slug of universities.map((university) => university.slug)) {
    assert.ok(
      manifest.markdown.some((entry) => entry.path === `unis/${slug}.md`),
      `missing mirror for /unis/${slug}/`,
    );
  }
  for (const slug of posts) {
    assert.ok(
      manifest.markdown.some((entry) => entry.path === `blog/${slug}.md`),
      `missing mirror for /blog/${slug}/`,
    );
  }
  assert.ok(manifest.markdown.every((entry) => entry.mediaType === MARKDOWN_MEDIA_TYPE));
  assert.ok(manifest.markdown.every((entry) => entry.route.startsWith("/")));
  assert.ok(manifest.markdown.every((entry) => entry.identity.trim().length > 0));

  // Sorted by path, so a rebuild cannot reorder the manifest and fail the
  // byte comparison in `compare:release`.
  assert.deepEqual(
    manifest.markdown.map((entry) => entry.path),
    [...manifest.markdown.map((entry) => entry.path)].sort(),
  );
});

test("the mirror path rule matches the one the pages advertise", async () => {
  // `src/content/seo.ts` builds the `rel=alternate` href and this module builds
  // the artifact path. Two implementations, one rule: if they disagree, every
  // page links at a mirror that is not there.
  const cases = [
    ["/", "/index.md"],
    ["/pricing/", "/pricing.md"],
    ["/unis/msu/", "/unis/msu.md"],
    ["/legal/terms/", "/legal/terms.md"],
  ];
  for (const [page, mirror] of cases) assert.equal(markdownMirrorPath(page), mirror);

  const snapshot = readContentSnapshot(root);
  for (const university of snapshot.universities) {
    assert.equal(markdownMirrorPath(university.path), university.mirrorPath);
  }
  for (const post of snapshot.posts) {
    assert.equal(markdownMirrorPath(post.path), post.mirrorPath);
  }
});

test("Markdown artifact validation rejects HTML, binary, unsupported claims, and identity drift", () => {
  const entry = UNIS_MIRROR_ENTRY;
  assert.doesNotThrow(() =>
    assertMarkdownArtifact(
      "# Поддерживаемые вузы – Vuzora\n\nМаршрут: `/unis/`.\n",
      entry,
    ),
  );
  const fixtures = [
    ["HTML", "<!doctype html><html><h1>Поддерживаемые вузы – Vuzora</h1></html>"],
    ["binary", "# Поддерживаемые вузы – Vuzora\n\0\nМаршрут: `/unis/`."],
    [
      "unsupported API",
      "# Поддерживаемые вузы – Vuzora\n\nМаршрут: `/unis/`.\nAPI endpoint: https://vuzora.ru/api.\n",
    ],
    ["identity", "# Каталог\n\nМаршрут: `/unis/`.\n"],
  ];
  for (const [label, body] of fixtures) {
    assert.throws(
      () => assertMarkdownArtifact(body, entry),
      /Markdown|HTML|binary|unsupported|identify/,
      label,
    );
  }
});

test("Markdown artifact validation evaluates every active unsupported claim", () => {
  const entry = UNIS_MIRROR_ENTRY;
  const fixtures = [
    [
      "active API after a negative claim",
      [
        "# Поддерживаемые вузы – Vuzora",
        "",
        "HTTP API is not available.",
        "The site provides an HTTP API.",
        "Маршрут: `/unis/`.",
      ].join("\n"),
    ],
    [
      "mixed-language OAuth claim after a negative claim",
      [
        "# Поддерживаемые вузы – Vuzora",
        "",
        "OAuth/OIDC вход не поддерживается.",
        "OAuth login is available.",
        "Маршрут: `/unis/`.",
      ].join("\n"),
    ],
    [
      "mixed-language remote MCP claim after a negative claim",
      [
        "# Поддерживаемые вузы – Vuzora",
        "",
        "Удалённый MCP-сервер отсутствует.",
        "Remote MCP integration is available.",
        "Маршрут: `/unis/`.",
      ].join("\n"),
    ],
    [
      "Server Card claim after a negative claim",
      [
        "# Поддерживаемые вузы – Vuzora",
        "",
        "MCP Server Card не публикуется.",
        "The MCP Server Card is published.",
        "Маршрут: `/unis/`.",
      ].join("\n"),
    ],
    [
      "official-service claim after a negative claim",
      [
        "# Поддерживаемые вузы – Vuzora",
        "",
        "Сервис не является официальным сервисом вуза.",
        "Vuzora is an official university service.",
        "Маршрут: `/unis/`.",
      ].join("\n"),
    ],
    [
      "Russian direct API claim",
      [
        "# Поддерживаемые вузы – Vuzora",
        "",
        "Vuzora предоставляет HTTP API.",
        "Маршрут: `/unis/`.",
      ].join("\n"),
    ],
    [
      "Russian direct OAuth claim",
      [
        "# Поддерживаемые вузы – Vuzora",
        "",
        "OAuth вход доступен.",
        "Маршрут: `/unis/`.",
      ].join("\n"),
    ],
    [
      "Russian direct protected-resource claim",
      [
        "# Поддерживаемые вузы – Vuzora",
        "",
        "Поддержка защищённого ресурса доступна.",
        "Маршрут: `/unis/`.",
      ].join("\n"),
    ],
    [
      "Russian direct official-service claim",
      [
        "# Поддерживаемые вузы – Vuzora",
        "",
        "Vuzora — официальный сервис вуза.",
        "Маршрут: `/unis/`.",
      ].join("\n"),
    ],
  ];
  for (const [label, body] of fixtures) {
    assert.throws(
      () => assertMarkdownArtifact(body, entry),
      /unsupported|advertises/i,
      label,
    );
  }
});

test("Markdown artifact validation preserves local negative boundaries", () => {
  const entry = UNIS_MIRROR_ENTRY;
  const body = [
    "# Поддерживаемые вузы – Vuzora",
    "",
    "HTTP API is not available; OAuth/OIDC login is not supported.",
    "No protected resource is exposed.",
    "Удалённый MCP-сервер отсутствует.",
    "MCP Server Card не публикуется.",
    "Сервис не является официальным сервисом вуза.",
    "Static-only, browser-local WebMCP is a read-only enhancement.",
    "Маршрут: `/unis/`.",
  ].join("\n");
  assert.doesNotThrow(() => assertMarkdownArtifact(body, entry));
});

test("Markdown artifact validation rejects direct MCP server claims in either language and order", () => {
  const entry = UNIS_MIRROR_ENTRY;
  const fixtures = [
    [
      "English active claim after a negative claim",
      [
        "# Поддерживаемые вузы – Vuzora",
        "",
        "HTTP API is not available but the site provides an MCP server.",
        "Маршрут: `/unis/`.",
      ].join("\n"),
    ],
    [
      "English active claim before a negative claim",
      [
        "# Поддерживаемые вузы – Vuzora",
        "",
        "The site provides an MCP server but HTTP API is not available.",
        "Маршрут: `/unis/`.",
      ].join("\n"),
    ],
    [
      "Russian active claim after a negative claim",
      [
        "# Поддерживаемые вузы – Vuzora",
        "",
        "HTTP API не поддерживается и сайт предоставляет MCP-сервер.",
        "Маршрут: `/unis/`.",
      ].join("\n"),
    ],
    [
      "Russian active claim before a negative claim",
      [
        "# Поддерживаемые вузы – Vuzora",
        "",
        "Сайт предоставляет MCP-сервер и HTTP API не поддерживается.",
        "Маршрут: `/unis/`.",
      ].join("\n"),
    ],
    [
      "mixed-language active claim",
      [
        "# Поддерживаемые вузы – Vuzora",
        "",
        "Удалённый MCP-сервер отсутствует, but an MCP server is available.",
        "Маршрут: `/unis/`.",
      ].join("\n"),
    ],
  ];
  for (const [label, body] of fixtures) {
    assert.throws(
      () => assertMarkdownArtifact(body, entry),
      /unsupported|advertises/i,
      label,
    );
  }
});

test("Markdown artifact validation evaluates conjunction-linked claims independently", () => {
  const entry = UNIS_MIRROR_ENTRY;
  const validBodies = [
    [
      "# Поддерживаемые вузы – Vuzora",
      "",
      "The site has no MCP server and HTTP API is not available.",
      "Маршрут: `/unis/`.",
    ].join("\n"),
    [
      "# Поддерживаемые вузы – Vuzora",
      "",
      "HTTP API is not available and the site has no MCP server.",
      "Маршрут: `/unis/`.",
    ].join("\n"),
    [
      "# Поддерживаемые вузы – Vuzora",
      "",
      "MCP-сервер отсутствует, а HTTP API не поддерживается.",
      "Маршрут: `/unis/`.",
    ].join("\n"),
    [
      "# Поддерживаемые вузы – Vuzora",
      "",
      "HTTP API не поддерживается, а MCP-сервер отсутствует.",
      "Маршрут: `/unis/`.",
    ].join("\n"),
  ];
  for (const body of validBodies) assert.doesNotThrow(() => assertMarkdownArtifact(body, entry));
});

test("Markdown artifact validation preserves static browser-local WebMCP wording", () => {
  const entry = UNIS_MIRROR_ENTRY;
  const body = [
    "# Поддерживаемые вузы – Vuzora",
    "",
    "Static-only, browser-local WebMCP is a read-only enhancement; no remote MCP server is provided.",
    "Маршрут: `/unis/`.",
  ].join("\n");
  assert.doesNotThrow(() => assertMarkdownArtifact(body, entry));
});

test("Markdown artifact validation applies unsupported-capability guards to auth.md", () => {
  const entry = ALL_ARTIFACTS.find((artifact) => artifact.path === "auth.md");
  assert.ok(entry);
  const base = [
    "# auth.md",
    "",
    "У Vuzora нет регистрации и входа.",
    "У сайта нет OAuth/OIDC issuer и нет token endpoint для токенов.",
    "У сайта нет защищённого HTTP API и нет аутентифицированного сервиса.",
    "Маршрут: `/auth.md`.",
  ];
  const fixtures = [
    ["English prose", "The site provides an MCP server."],
    ["Russian prose", "Сайт предоставляет MCP-сервер."],
  ];
  for (const [label, claim] of fixtures) {
    assert.throws(
      () => assertMarkdownArtifact([...base, claim].join("\n"), entry),
      /unsupported|advertises/i,
      label,
    );
  }
});

test("Markdown artifact validation segments independently negative nor clauses", () => {
  const entry = ALL_ARTIFACTS.find((artifact) => artifact.path === "auth.md");
  assert.ok(entry);
  const base = [
    "# auth.md",
    "",
    "У Vuzora нет регистрации и входа.",
    "У сайта нет OAuth/OIDC issuer и нет token endpoint для токенов.",
    "У сайта нет защищённого HTTP API и нет аутентифицированного сервиса.",
    "Маршрут: `/auth.md`.",
  ];
  const validBodies = [
    "The site has no MCP server nor an MCP server is available.",
    "An MCP server is unavailable nor does the site provide an MCP server.",
  ];
  for (const claim of validBodies)
    assert.doesNotThrow(() => assertMarkdownArtifact([...base, claim].join("\n"), entry));
});

test("Markdown release validation fails closed on missing, extra, empty, and divergent artifacts", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "vuzora-markdown-artifacts-"));
  try {
    for (const directory of ["public", "dist"]) await mkdir(join(fixtureRoot, directory), { recursive: true });
    for (const entry of ALL_ARTIFACTS) {
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
      manifest: ALL_ARTIFACTS,
    });
    assert.equal(valid.entries.length, ALL_ARTIFACTS.length);

    const activeAfterNegative = [
      "# Поддерживаемые вузы – Vuzora",
      "",
      "HTTP API не реализован.",
      "OAuth/OIDC login is available.",
      "Маршрут: `/unis/`.",
    ].join("\n");
    await writeFile(join(fixtureRoot, "public", "unis.md"), activeAfterNegative, "utf8");
    await writeFile(join(fixtureRoot, "dist", "unis.md"), activeAfterNegative, "utf8");
    await assert.rejects(
      () =>
        assertMarkdownRelease({
          root: fixtureRoot,
          dist: join(fixtureRoot, "dist"),
          manifest: ALL_ARTIFACTS,
        }),
      /unsupported|advertises/i,
    );
    await cp(join(root, "public", "unis.md"), join(fixtureRoot, "public", "unis.md"));
    await cp(join(root, "public", "unis.md"), join(fixtureRoot, "dist", "unis.md"));

    await rm(join(fixtureRoot, "dist", "unis.md"));
    await assert.rejects(
      () =>
        assertMarkdownRelease({
          root: fixtureRoot,
          dist: join(fixtureRoot, "dist"),
          manifest: ALL_ARTIFACTS,
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
          manifest: ALL_ARTIFACTS,
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
          manifest: ALL_ARTIFACTS,
        }),
      /inventory/,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

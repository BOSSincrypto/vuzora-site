import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  AUTH_BOUNDARY_MEDIA_TYPE,
  AUTH_BOUNDARY_PATH,
  DISCOVERY_NEGATIVE_PATHS,
  assertAuthBoundaryDocument,
  assertDiscoveryBoundaryRelease,
} from "./discovery-boundaries.mjs";

const root = process.cwd();

test("auth.md is an explicit no-auth Markdown boundary", async () => {
  const body = await readFile(join(root, "public", AUTH_BOUNDARY_PATH.slice(1)), "utf8");
  assert.equal(AUTH_BOUNDARY_MEDIA_TYPE, "text/markdown");
  assert.doesNotThrow(() => assertAuthBoundaryDocument(body));
  assert.match(body, /^#\s+auth\.md\s*$/im);
  assert.match(body, /нет регистрации и входа/i);
  assert.match(body, /OAuth\/OIDC/i);
  assert.match(body, /токен/i);
  assert.match(body, /защищённого HTTP API/i);
  assert.match(body, /аутентифицированного сервиса/i);
});

test("negative protocol candidates are fixed and absent from public artifacts", async () => {
  assert.deepEqual(DISCOVERY_NEGATIVE_PATHS, [
    "/.well-known/openid-configuration",
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-protected-resource",
    "/.well-known/mcp/server-card.json",
  ]);
  assert.doesNotThrow(() => assertDiscoveryBoundaryRelease({ root, dist: join(root, "dist") }));
});

test("edge runbook keeps DNS-AID owner roles and deployment boundaries explicit", async () => {
  const runbook = await readFile(join(root, "AGENT-DISCOVERY-EDGE-RUNBOOK.md"), "utf8");
  assert.match(runbook, /exact DNS-AID draft and version/i);
  assert.match(runbook, /<agent-owner-fqdn>/);
  assert.match(runbook, /`_index\._agents\.<domain>`.*organization-level index/i);
  assert.match(runbook, /agent-specific primary owner/i);
  assert.match(runbook, /`_a2a\._agents` is not a\s+universal owner name/i);
  assert.doesNotMatch(runbook, /_a2a\._agents\.<zone>/i);
  assert.doesNotMatch(runbook, /NAME=['"]_a2a\._agents\.vuzora\.ru['"]/i);
  assert.match(runbook, /not deployed or simulated by this static repository/i);
  assert.match(runbook, /HTTP `Link` response headers/i);
  assert.match(runbook, /DNS-AID SVCB\/HTTPS records or DNSSEC proofs/i);
  assert.match(runbook, /True `Accept: text\/markdown` content negotiation/i);
  assert.match(runbook, /static GitHub Pages artifact/i);
});

test("discovery release validation rejects auth claims, secrets, and protocol artifacts", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "vuzora-discovery-boundary-"));
  try {
    await cp(root, fixtureRoot, {
      recursive: true,
      filter: (source) => !source.includes("node_modules"),
    });
    const authPath = join(fixtureRoot, "public", "auth.md");
    await writeFile(
      join(fixtureRoot, "dist", "auth.md"),
      await readFile(authPath, "utf8"),
      "utf8",
    );
    const invalidAuthDocuments = [
      ["fictional endpoint", "# auth.md\n\nOAuth provider issuer: https://vuzora.ru/oauth/token.\n"],
      ["secret", "# auth.md\n\nNo login exists, but sk_live_12345678901234567890 must stay private.\n"],
      ["token instruction", "# auth.md\n\nUse OAuth to obtain a token from the fictional service.\n"],
    ];
    for (const [label, invalidBody] of invalidAuthDocuments) {
      await writeFile(authPath, invalidBody, "utf8");
      await writeFile(join(fixtureRoot, "dist", "auth.md"), invalidBody, "utf8");
      await assert.rejects(
        () => assertDiscoveryBoundaryRelease({ root: fixtureRoot, dist: join(fixtureRoot, "dist") }),
        /auth\.md|unsupported|secret|token|endpoint/i,
        label,
      );
    }

    await cp(root, fixtureRoot, {
      recursive: true,
      filter: (source) => !source.includes("node_modules"),
    });
    await writeFile(
      join(fixtureRoot, "public", "auth.md"),
      await readFile(join(root, "public", "auth.md"), "utf8"),
      "utf8",
    );
    await writeFile(
      join(fixtureRoot, "dist", "auth.md"),
      await readFile(join(fixtureRoot, "public", "auth.md"), "utf8"),
      "utf8",
    );
    await writeFile(
      join(fixtureRoot, "dist", ".well-known", "oauth-authorization-server"),
      "{}\n",
      "utf8",
    );
    await assert.rejects(
      () => assertDiscoveryBoundaryRelease({ root: fixtureRoot, dist: join(fixtureRoot, "dist") }),
      /negative|OAuth|protocol|well-known/i,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("scans every text artifact and normalizes active discovery references", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "vuzora-discovery-surfaces-"));
  try {
    await cp(root, fixtureRoot, {
      recursive: true,
      filter: (source) => !source.includes("node_modules"),
    });

    const forms = [
      ["html", "fixtures/discovery.html", "<a href='/.well-known/openid-configuration/'>bad</a>"],
      ["markdown", "fixtures/discovery.md", "[metadata](%2F.well-known%2Foauth-authorization-server)"],
      [
        "json",
        "fixtures/discovery.json",
        '{"url":"https:\\/\\/vuzora.ru\\/.well-known\\/oauth-protected-resource\\/"}',
      ],
      ["javascript", "fixtures/discovery.js", 'const metadata = "../.well-known/mcp/server-card.json";'],
      ["css", "fixtures/discovery.css", "background: url('https://vuzora.ru/.well-known/openid-configuration');"],
      ["svg", "fixtures/discovery.svg", "<a href='/.well-known/oauth-authorization-server'>bad</a>"],
      ["xml", "fixtures/discovery.xml", '<link href="https://vuzora.ru/.well-known/oauth-protected-resource/"/>'],
      ["plain text", "fixtures/discovery.txt", "https://vuzora.ru/%2Ewell-known%2Fmcp%2Fserver-card.json"],
    ];

    for (const [label, artifact, body] of forms) {
      const publicPath = join(fixtureRoot, "public", artifact);
      const distPath = join(fixtureRoot, "dist", artifact);
      await mkdir(dirname(publicPath), { recursive: true });
      await mkdir(dirname(distPath), { recursive: true });
      await writeFile(publicPath, body, "utf8");
      await writeFile(distPath, body, "utf8");
      await assert.rejects(
        () => assertDiscoveryBoundaryRelease({ root: fixtureRoot, dist: join(fixtureRoot, "dist") }),
        /negative discovery path|secret-like|OAuth|implemented/i,
        label,
      );
      await rm(publicPath);
      await rm(distPath);
    }
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("preserves negative boundary wording and unrelated links", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "vuzora-discovery-negative-"));
  try {
    await cp(root, fixtureRoot, {
      recursive: true,
      filter: (source) => !source.includes("node_modules"),
    });
    const body = [
      "The OAuth discovery path is not deployed: /.well-known/openid-configuration.",
      "RFC 8414 is a reference, not a deployed endpoint.",
      "Unrelated documentation: https://example.com/.well-known/openid-configuration.",
      "Telegram: https://t.me/vuzora_bot?start=from-site.",
      "Browser-local read-only WebMCP remains a local enhancement.",
    ].join("\n");
    for (const base of ["public", "dist"]) {
      const target = join(fixtureRoot, base, "fixtures", "negative.txt");
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, body, "utf8");
    }
    await assert.doesNotReject(() =>
      assertDiscoveryBoundaryRelease({ root: fixtureRoot, dist: join(fixtureRoot, "dist") }),
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("ignores binary assets while checking text artifacts", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "vuzora-discovery-binary-"));
  try {
    await cp(root, fixtureRoot, {
      recursive: true,
      filter: (source) => !source.includes("node_modules"),
    });
    const body = Buffer.from("\0https://vuzora.ru/.well-known/openid-configuration\0", "utf8");
    for (const base of ["public", "dist"]) {
      const target = join(fixtureRoot, base, "assets", "fixture.dat");
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, body);
    }
    await assert.doesNotReject(() =>
      assertDiscoveryBoundaryRelease({ root: fixtureRoot, dist: join(fixtureRoot, "dist") }),
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

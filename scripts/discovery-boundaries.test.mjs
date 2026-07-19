import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
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

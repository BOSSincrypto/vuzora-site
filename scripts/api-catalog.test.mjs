import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  API_CATALOG_PATH,
  API_CATALOG_MEDIA_TYPE,
  assertApiCatalog,
  buildApiCatalog,
} from "./api-catalog.mjs";
import { validateRelease } from "./release-validator.mjs";

const root = process.cwd();
const catalogPath = join(root, "public", API_CATALOG_PATH.replace(/^\/+/, ""));
const readCatalog = () => readFile(catalogPath, "utf8");

test("the production catalog is a truthful linkset with static discovery links", async () => {
  const source = await readCatalog();
  const catalog = JSON.parse(source);

  assert.equal(API_CATALOG_MEDIA_TYPE, "application/linkset+json");
  assert.deepEqual(catalog, buildApiCatalog());
  assert.doesNotThrow(() => assertApiCatalog(catalog, { availablePaths: ["/llms.txt"] }));
  assert.match(source, /does not implement an HTTP API/i);
});

test("catalog validation fails closed for malformed, fictional, secret-bearing, and API-claiming content", async () => {
  const valid = buildApiCatalog();
  const cases = [
    ["malformed JSON", "{", /malformed/i],
    ["missing linkset", { ...valid, linkset: [] }, /linkset array must contain/i],
    [
      "unreachable static link",
      valid,
      /static discovery|real/i,
      { availablePaths: [] },
    ],
    [
      "fictional link",
      {
        ...valid,
        linkset: [{
          ...valid.linkset[0],
          link: [{ href: "https://vuzora.ru/.well-known/openapi.json", rel: "describedby", type: "application/json" }],
        }],
      },
      /static discovery|unsupported|real/i,
    ],
    [
      "secret-bearing content",
      {
        ...valid,
        description: `Vuzora does not implement an HTTP API. token=${["s", "k_live_12345678901234567890"].join("")}`,
      },
      /secret|credential/i,
    ],
    [
      "executable API claim",
      {
        ...valid,
        description: "Vuzora does not implement an HTTP API. OpenAPI service description for an API endpoint",
      },
      /unsupported|API endpoint|OpenAPI/i,
    ],
    [
      "wrong origin",
      {
        ...valid,
        linkset: [{
          ...valid.linkset[0],
          link: [{ href: "https://example.com/llms.txt", rel: "describedby", type: "text/plain" }],
        }],
      },
      /production origin|canonical/i,
    ],
  ];

  for (const [label, fixture, message, options] of cases) {
    assert.throws(
      () => assertApiCatalog(fixture, options ?? { availablePaths: ["/llms.txt"] }),
      message,
      label,
    );
  }
});

test("validate:release rejects a missing or divergent built catalog", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "vuzora-api-catalog-"));
  try {
    await cp(root, fixtureRoot, {
      recursive: true,
      filter: (source) => !source.includes("node_modules"),
    });
    const distCatalogPath = join(fixtureRoot, "dist", API_CATALOG_PATH.replace(/^\/+/, ""));
    await rm(distCatalogPath);
    await assert.rejects(
      () => validateRelease({ root: fixtureRoot, dist: join(fixtureRoot, "dist") }),
      /API catalog:.*release artifact is missing/i,
    );
    await writeFile(distCatalogPath, `${JSON.stringify({ linkset: [] })}\n`, "utf8");
    await assert.rejects(
      () => validateRelease({ root: fixtureRoot, dist: join(fixtureRoot, "dist") }),
      /API catalog:|linkset array must contain/i,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

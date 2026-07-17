import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  assertLlmsJoin,
  assertRobotsAllowsLlms,
  buildLlmsPacket,
  detailUrl,
  extractDetailUrls,
  robotsDisallowsPath,
  SECRET_PATTERN_RE,
} from "./llms-packet.mjs";
import { readRegistry } from "./route-policy.mjs";

const root = process.cwd();
const read = (path) => readFile(join(root, path), "utf8");

test("buildLlmsPacket joins full registry with absolute production detail URLs", async () => {
  const { universities, affiliationBoundary } = await readRegistry(root);
  assert.equal(universities.length, 25);
  const body = buildLlmsPacket(universities, { affiliationBoundary });
  const result = assertLlmsJoin(body, universities, { affiliationBoundary });
  assert.equal(result.expectedCount, 25);
  assert.equal(result.foundCount, 25);
  for (const university of universities) {
    assert.ok(body.includes(detailUrl(university.slug)));
    assert.ok(
      body.includes(university.name) || body.includes(university.code),
      `identity for ${university.slug}`,
    );
  }
});

test("committed public/llms.txt matches registry join policy", async () => {
  const { universities, affiliationBoundary } = await readRegistry(root);
  const body = await read("public/llms.txt");
  assertLlmsJoin(body, universities, { affiliationBoundary });
  const expected = buildLlmsPacket(universities, { affiliationBoundary });
  assert.equal(
    body,
    expected,
    "public/llms.txt must equal buildLlmsPacket(registry); run node scripts/generate-llms.mjs",
  );
});

test("underlisted llms packet fails closed", async () => {
  const { universities, affiliationBoundary } = await readRegistry(root);
  const under = universities.slice(0, Math.max(1, universities.length - 3));
  const body = buildLlmsPacket(under, { affiliationBoundary });
  assert.throws(
    () => assertLlmsJoin(body, universities, { affiliationBoundary }),
    /underlist|missing/i,
  );
});

test("overlisted llms packet fails closed on phantom slugs", async () => {
  const { universities, affiliationBoundary } = await readRegistry(root);
  const body =
    buildLlmsPacket(universities, { affiliationBoundary }) +
    `\n- Phantom University (PHANTOM): ${detailUrl("phantom-not-in-registry")}\n`;
  assert.throws(
    () => assertLlmsJoin(body, universities, { affiliationBoundary }),
    /overlist|phantom/i,
  );
});

test("duplicate detail URLs fail bijective join", async () => {
  const { universities, affiliationBoundary } = await readRegistry(root);
  const body =
    buildLlmsPacket(universities, { affiliationBoundary }) +
    `\n- Duplicate: ${detailUrl(universities[0].slug)}\n`;
  assert.throws(
    () => assertLlmsJoin(body, universities, { affiliationBoundary }),
    /duplicate|bijective|count mismatch/i,
  );
});

test("packet documents CTA attribution and non-official Russian product positioning", async () => {
  const { universities, affiliationBoundary } = await readRegistry(root);
  const body = buildLlmsPacket(universities, { affiliationBoundary });
  assert.match(body, /from-site/);
  assert.match(body, /from-site_/);
  assert.match(body, /t\.me\/vuzora_bot/);
  assert.match(body, /неофициальн|не является официальным сервисом/i);
  assert.match(body, /Telegram/i);
  assert.match(body, /расписан/i);
  assert.match(body, /утр/i);
  assert.equal(SECRET_PATTERN_RE.test(body), false);
  assert.doesNotMatch(body, /официальн(?:ый|ого)\s+партн/i);
});

test("robots does not Disallow /llms.txt", async () => {
  const robots = await read("public/robots.txt");
  assertRobotsAllowsLlms(robots, "/llms.txt");
  assert.equal(robotsDisallowsPath(robots, "/llms.txt"), false);
  assert.equal(robotsDisallowsPath("User-agent: *\nDisallow: /llms.txt\n", "/llms.txt"), true);
  assert.equal(robotsDisallowsPath("User-agent: *\nDisallow: /llms\n", "/llms.txt"), true);
  assert.equal(robotsDisallowsPath("User-agent: *\nDisallow: /api/\n", "/llms.txt"), false);
});

test("extractDetailUrls only accepts absolute production hosts", () => {
  const body = [
    "https://vuzora.ru/unis/msu",
    "http://vuzora.ru/unis/hse",
    "https://example.com/unis/mipt",
    "/unis/bmstu",
  ].join("\n");
  assert.deepEqual(
    extractDetailUrls(body).map((entry) => entry.slug),
    ["msu"],
  );
});

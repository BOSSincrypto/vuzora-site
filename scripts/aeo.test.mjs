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

test("extractDetailUrls only accepts exact canonical detail URLs", () => {
  const body = [
    "https://vuzora.ru/unis/msu",
    "https://vuzora.ru/unis/hse/overview",
    "https://vuzora.ru/unis/mipt?tab=about",
    "https://vuzora.ru/unis/bmstu#faq",
    "http://vuzora.ru/unis/sfu",
    "https://example.com/unis/rggu",
    "/unis/susu",
  ].join("\n");
  assert.deepEqual(
    extractDetailUrls(body).map((entry) => entry.slug),
    ["msu"],
  );
});

test("non-canonical detail URL variants fail closed", async () => {
  const { universities, affiliationBoundary } = await readRegistry(root);
  const canonical = buildLlmsPacket(universities, { affiliationBoundary });
  for (const suffix of ["/overview", "?tab=about", "#faq"]) {
    const body = canonical.replace(
      detailUrl(universities[0].slug),
      `${detailUrl(universities[0].slug)}${suffix}`,
    );
    assert.throws(
      () => assertLlmsJoin(body, universities, { affiliationBoundary }),
      /non-canonical|detail URL|underlist/i,
      `variant ${suffix} must be rejected`,
    );
  }
});

test("swapped university identities fail the URL-row bijective join", async () => {
  const { universities, affiliationBoundary } = await readRegistry(root);
  const canonical = buildLlmsPacket(universities, { affiliationBoundary });
  const first = universities[0];
  const second = universities[1];
  const swapped = canonical
    .replace(
      `- ${first.name} (${first.code}): ${detailUrl(first.slug)}`,
      `- ${second.name} (${second.code}): ${detailUrl(first.slug)}`,
    )
    .replace(
      `- ${second.name} (${second.code}): ${detailUrl(second.slug)}`,
      `- ${first.name} (${first.code}): ${detailUrl(second.slug)}`,
    );
  assert.throws(
    () => assertLlmsJoin(swapped, universities, { affiliationBoundary }),
    /row identity|identity mismatch/i,
  );
});

test("university rows require local name or code identity", async () => {
  const { universities, affiliationBoundary } = await readRegistry(root);
  const university = universities[0];
  const canonical = buildLlmsPacket(universities, { affiliationBoundary });
  const withoutLocalIdentity = canonical.replace(
    `- ${university.name} (${university.code}): ${detailUrl(university.slug)}`,
    `- Поддерживаемый вуз: ${detailUrl(university.slug)}`,
  );
  assert.throws(
    () => assertLlmsJoin(withoutLocalIdentity, universities, { affiliationBoundary }),
    /row identity|identity mismatch/i,
  );
});

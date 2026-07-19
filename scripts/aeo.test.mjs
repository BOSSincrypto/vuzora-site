import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  assertLlmsJoin,
  assertContentSignalPolicy,
  assertRobotsAllowsLlms,
  assertRobotsPolicy,
  buildLlmsPacket,
  deriveDiscoveryRoutes,
  detailUrl,
  extractDetailUrls,
  NAMED_AI_CRAWLERS,
  robotsAllowsPath,
  robotsDisallowsPath,
  SECRET_PATTERN_RE,
} from "./llms-packet.mjs";
import { buildRoutes, readRegistry } from "./route-policy.mjs";

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
  const { universities, posts, affiliationBoundary } = await readRegistry(root);
  const discoveryRoutes = deriveDiscoveryRoutes({
    routes: [...buildRoutes({ universities, posts }), "/blog/rss.xml", "/sitemap.xml"],
  });
  const body = await read("public/llms.txt");
  assertLlmsJoin(body, universities, { affiliationBoundary, discoveryRoutes });
  const expected = buildLlmsPacket(universities, { affiliationBoundary, discoveryRoutes });
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

test("llms packet derives and joins every published discovery surface", async () => {
  const { universities, affiliationBoundary } = await readRegistry(root);
  const discoveryRoutes = deriveDiscoveryRoutes({
    routes: [
      "/",
      "/pricing",
      "/changelog",
      "/unis",
      "/blog/",
      "/blog/rss.xml",
      "/sitemap.xml",
      "/legal/terms",
      "/legal/privacy",
    ],
  });
  const body = buildLlmsPacket(universities, { affiliationBoundary, discoveryRoutes });
  assert.doesNotThrow(() => assertLlmsJoin(body, universities, { affiliationBoundary, discoveryRoutes }));
  for (const path of discoveryRoutes) assert.equal((body.match(new RegExp(`https://vuzora\\.ru${path === "/" ? "/" : path}`, "g")) ?? []).length >= 1, true);
  assert.equal(deriveDiscoveryRoutes({ routes: ["/", "/pricing", "/unis"] }).includes("/changelog"), false);
  assert.equal(deriveDiscoveryRoutes({ routes: ["/", "/legal/terms"] }).includes("/legal/privacy"), false);
});

test("discovery join rejects missing, phantom, duplicate, and alternate-origin surfaces", async () => {
  const { universities, affiliationBoundary } = await readRegistry(root);
  const discoveryRoutes = deriveDiscoveryRoutes({
    routes: ["/", "/pricing", "/changelog", "/unis", "/blog/", "/blog/rss.xml", "/sitemap.xml", "/legal/terms"],
  });
  const valid = buildLlmsPacket(universities, { affiliationBoundary, discoveryRoutes });
  const missing = valid.replace(`- [Что нового](https://vuzora.ru/changelog)\n`, "");
  assert.throws(
    () => assertLlmsJoin(missing, universities, { affiliationBoundary, discoveryRoutes }),
    /discovery underlist|missing/i,
  );
  const phantom = `${valid}- [Phantom](https://vuzora.ru/not-a-real-public-route)\n`;
  assert.throws(
    () => assertLlmsJoin(phantom, universities, { affiliationBoundary, discoveryRoutes }),
    /discovery overlist|phantom|non-production/i,
  );
  const duplicate = `${valid}- [Блог снова](https://vuzora.ru/blog/)\n`;
  assert.throws(
    () => assertLlmsJoin(duplicate, universities, { affiliationBoundary, discoveryRoutes }),
    /discovery join|duplicate/i,
  );
  const alternateOrigin = valid.replace(
    "https://vuzora.ru/pricing",
    "https://example.com/pricing",
  );
  assert.throws(
    () => assertLlmsJoin(alternateOrigin, universities, { affiliationBoundary, discoveryRoutes }),
    /non-production|discovery/i,
  );
});

test("robots does not Disallow /llms.txt", async () => {
  const robots = await read("public/robots.txt");
  assertRobotsAllowsLlms(robots, "/llms.txt");
  assert.equal(robotsDisallowsPath(robots, "/llms.txt"), false);
  assert.equal(robotsDisallowsPath("User-agent: *\nDisallow: /llms.txt\n", "/llms.txt"), true);
  assert.equal(robotsDisallowsPath("User-agent: *\nDisallow: /llms\n", "/llms.txt"), true);
  assert.equal(robotsDisallowsPath("User-agent: *\nDisallow: /api/\n", "/llms.txt"), false);
});

test("robots explicitly allows named AI crawlers across public AEO paths", async () => {
  const robots = await read("public/robots.txt");
  const policy = assertRobotsPolicy(robots);
  assert.deepEqual(policy.namedAgents, NAMED_AI_CRAWLERS);
  for (const agent of NAMED_AI_CRAWLERS) {
    for (const path of ["/", "/llms.txt", "/blog/rss.xml", "/sitemap.xml", "/blog/"]) {
      assert.equal(
        robotsAllowsPath(robots, path, agent),
        true,
        `${agent} should be allowed to crawl ${path}`,
      );
    }
    assert.equal(robotsAllowsPath(robots, "/api/", agent), false, `${agent} must not crawl /api/`);
  }
  for (const path of ["/", "/llms.txt", "/blog/rss.xml", "/sitemap.xml", "/blog/"]) {
    assert.equal(robotsAllowsPath(robots, path, "*"), true, `wildcard should allow ${path}`);
  }
  assert.equal(robotsAllowsPath(robots, "/api/", "*"), false);
  assert.doesNotMatch(robots, /citation|ranking|guarantee/i);
});

test("robots publishes the exact approved Content-Signal policy", async () => {
  const robots = await read("public/robots.txt");
  assert.deepEqual(assertContentSignalPolicy(robots), {
    "ai-train": "yes",
    search: "yes",
    "ai-input": "yes",
  });
});

test("Content-Signal parser rejects missing, conflicting, malformed, and extra values", () => {
  const valid = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Content-Signal: ai-train=yes, search=yes, ai-input=yes",
  ].join("\n");
  assert.deepEqual(assertContentSignalPolicy(valid), {
    "ai-train": "yes",
    search: "yes",
    "ai-input": "yes",
  });

  const fixtures = [
    ["missing value", valid.replace(", ai-input=yes", ""), /missing|exact/i],
    ["conflicting value", valid.replace("ai-train=yes", "ai-train=no"), /conflict|approved|value/i],
    ["malformed value", valid.replace("search=yes", "search"), /malformed|format|value/i],
    ["extra value", valid.replace("ai-input=yes", "ai-input=yes, ai-citations=yes"), /extra|unsupported|exact/i],
    [
      "__proto__ key extra value",
      valid.replace("ai-input=yes", "ai-input=yes, __proto__=yes"),
      /extra|unsupported|exact/i,
    ],
    [
      "constructor-key extra value",
      valid.replace("ai-input=yes", "ai-input=yes, constructor=yes"),
      /extra|unsupported|exact/i,
    ],
    [
      "prototype key extra value",
      valid.replace("ai-input=yes", "ai-input=yes, prototype=yes"),
      /extra|unsupported|exact/i,
    ],
    [
      "duplicate value",
      valid.replace("ai-input=yes", "ai-input=yes, search=yes"),
      /duplicate/i,
    ],
  ];
  for (const [label, fixture, message] of fixtures) {
    assert.throws(() => assertContentSignalPolicy(fixture), message, label);
  }
});

test("validate:release rejects robots policies that drift from named crawler access", async () => {
  const { validateRelease } = await import("./release-validator.mjs");
  const original = await read("dist/robots.txt");
  const fixtureRoot = await mkdtemp(join(tmpdir(), "vuzora-robots-"));
  try {
    await cp(root, fixtureRoot, {
      recursive: true,
      filter: (source) => !source.includes("node_modules"),
    });
    const missingNamedAgent = original.replace(/^User-agent:\s*Gemini[\s\S]*?^Allow:\s*\/\s*$/im, "");
    await writeFile(join(fixtureRoot, "dist/robots.txt"), missingNamedAgent, "utf8");
    await assert.rejects(
      () => validateRelease({ root: fixtureRoot, dist: join(fixtureRoot, "dist") }),
      /robots\.txt.*(?:named|Gemini|AI crawler)|GPTBot|Gemini/i,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("validate:release rejects Content-Signal policy drift fixtures", async () => {
  const { validateRelease } = await import("./release-validator.mjs");
  const original = await read("dist/robots.txt");
  const fixtureRoot = await mkdtemp(join(tmpdir(), "vuzora-content-signal-"));
  try {
    await cp(root, fixtureRoot, {
      recursive: true,
      filter: (source) => !source.includes("node_modules"),
    });
    const fixtures = [
      ["missing", original.replace(/^Content-Signal:.*$/im, ""), /Content-Signal|signal|missing/i],
      [
        "conflicting",
        original.replace("ai-train=yes", "ai-train=no"),
        /Content-Signal|signal|approved|conflict/i,
      ],
      [
        "malformed",
        original.replace("search=yes", "search"),
        /Content-Signal|signal|malformed|format/i,
      ],
      [
        "extra",
        original.replace("ai-input=yes", "ai-input=yes, ai-citations=yes"),
        /Content-Signal|signal|extra|unsupported/i,
      ],
      [
        "__proto__ key extra",
        original.replace("ai-input=yes", "ai-input=yes, __proto__=yes"),
        /Content-Signal|signal|extra|unsupported/i,
      ],
      [
        "constructor-key extra",
        original.replace("ai-input=yes", "ai-input=yes, constructor=yes"),
        /Content-Signal|signal|extra|unsupported/i,
      ],
      [
        "prototype key extra",
        original.replace("ai-input=yes", "ai-input=yes, prototype=yes"),
        /Content-Signal|signal|extra|unsupported/i,
      ],
      [
        "duplicate",
        original.replace("ai-input=yes", "ai-input=yes, search=yes"),
        /Content-Signal|signal|duplicate/i,
      ],
    ];
    for (const [label, fixture, message] of fixtures) {
      await writeFile(join(fixtureRoot, "dist/robots.txt"), fixture, "utf8");
      await assert.rejects(
        () => validateRelease({ root: fixtureRoot, dist: join(fixtureRoot, "dist") }),
        message,
        label,
      );
    }
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("validate:release rejects missing and phantom discovery-surface fixtures", async () => {
  const { validateRelease } = await import("./release-validator.mjs");
  const original = await read("dist/llms.txt");
  const fixtureRoot = await mkdtemp(join(tmpdir(), "vuzora-llms-discovery-"));
  try {
    await cp(root, fixtureRoot, {
      recursive: true,
      filter: (source) => !source.includes("node_modules"),
    });
    const fixtures = [
      [
        "missing discovery surface",
        original.replace("- [Что нового](https://vuzora.ru/changelog)\n", ""),
        /llms\.txt.*(?:discovery|underlist|missing)/i,
      ],
      [
        "phantom discovery surface",
        `${original}- [Phantom](https://vuzora.ru/not-a-real-public-route)\n`,
        /llms\.txt.*(?:discovery|overlist|phantom)/i,
      ],
    ];
    for (const [label, fixture, message] of fixtures) {
      await writeFile(join(fixtureRoot, "dist/llms.txt"), fixture, "utf8");
      await assert.rejects(
        () => validateRelease({ root: fixtureRoot, dist: join(fixtureRoot, "dist") }),
        message,
        label,
      );
    }
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
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

test("university rows reject multiple canonical detail URLs", async () => {
  const { universities, affiliationBoundary } = await readRegistry(root);
  const first = universities[0];
  const second = universities[1];
  const canonical = buildLlmsPacket(universities, { affiliationBoundary });
  const firstRow = `- ${first.name} (${first.code}): ${detailUrl(first.slug)}`;
  const secondRow = `- ${second.name} (${second.code}): ${detailUrl(second.slug)}`;
  const multiUrlRow = canonical.replace(
    `${firstRow}\n${secondRow}`,
    `${firstRow}; ${second.name} (${second.code}): ${detailUrl(second.slug)}`,
  );
  assert.throws(
    () => assertLlmsJoin(multiUrlRow, universities, { affiliationBoundary }),
    /row|multiple|exactly one|detail URL/i,
  );
});

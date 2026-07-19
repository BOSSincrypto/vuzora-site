import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  assertIndependent404,
  assertManifest,
  assertUniversityCtaOrder,
  validateRouteDocument,
  assertSitemap,
  parseHtmlDocument,
  parseSitemapXml,
  routeMetadataFailures,
  validateRelease,
} from "./release-validator.mjs";
import { assertLlmsJoin, buildLlmsPacket, detailUrl } from "./llms-packet.mjs";
import { artifactFor, buildRoutes, readRegistry, routeExpectationFor } from "./route-policy.mjs";
import { hashReleaseBytes, normalizeSitemapLastmodBytes } from "./compare-release.mjs";

const baseHtml = (body, head = "") =>
  `<!doctype html><html><head><title>Страница Vuzora для проверки</title><meta name="description" content="Достаточно длинное описание страницы Vuzora для детерминированной проверки релизного контракта без заглушек."/><link rel="canonical" href="https://vuzora.ru/test"/><meta property="og:url" content="https://vuzora.ru/test"/><meta property="og:type" content="website"/>${head}</head><body><main><h1>Страница Vuzora для проверки</h1>${body}</main></body></html>`;

const routes = ["/", "/pricing"];

async function releaseFixture(mutator, expectedMessage) {
  const root = process.cwd();
  const fixtureRoot = await mkdtemp(join(tmpdir(), "vuzora-route-metadata-"));
  await cp(root, fixtureRoot, {
    recursive: true,
    filter: (source) => !source.includes("node_modules"),
  });
  try {
    await mutator(fixtureRoot);
    await assert.rejects(
      () => validateRelease({ root: fixtureRoot, dist: join(fixtureRoot, "dist") }),
      expectedMessage,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

const metadataFixture = (route, overrides = {}) => {
  const canonical = overrides.canonical ?? `https://vuzora.ru${route}`;
  const description = overrides.description ?? "Маршрут Vuzora с полезным описанием для студентов и утренней доставки расписания.";
  const robots = overrides.robots ?? "index, follow";
  const locale = overrides.locale ?? "ru_RU";
  const alternates = overrides.alternates ?? `
    <link rel="alternate" type="application/rss+xml" href="https://vuzora.ru/blog/rss.xml"/>
    <link rel="alternate" type="text/plain" href="https://vuzora.ru/llms.txt"/>
  `;
  return `<!doctype html><html lang="ru"><head>
    <title>Маршрут Vuzora для проверки</title>
    <meta name="description" content="${description}"/>
    <meta name="robots" content="${robots}"/>
    <meta property="og:locale" content="${locale}"/>
    <link rel="canonical" href="${canonical}"/>
    ${alternates}
  </head><body><main><h1>Проверка маршрута</h1></main></body></html>`;
};

test("indexable route matrix requires shared discovery metadata and preserves noindex/phantom fixtures", async () => {
  const { universities, posts } = await readRegistry();
  const indexableRoutes = buildRoutes({ universities, posts });
  const routeClasses = [
    "/",
    "/pricing",
    "/changelog",
    "/unis",
    `/unis/${universities[0].slug}`,
    "/blog/",
    `/blog/${posts[0]}`,
    "/legal/terms",
    "/legal/privacy",
  ];

  for (const route of routeClasses) {
    assert.deepEqual(routeMetadataFailures(parseHtmlDocument(metadataFixture(route)), route), []);
  }

  const missingDescription = parseHtmlDocument(
    metadataFixture("/pricing", { description: "коротко" }),
  );
  assert.match(routeMetadataFailures(missingDescription, "/pricing").join("\n"), /description/);

  const duplicateCanonical = parseHtmlDocument(
    metadataFixture("/changelog", {
      alternates: `
        <link rel="canonical" href="https://vuzora.ru/changelog"/>
        <link rel="canonical" href="https://vuzora.ru/changelog"/>
      `,
    }),
  );
  assert.match(routeMetadataFailures(duplicateCanonical, "/changelog").join("\n"), /canonical/);

  const wrongOrigin = parseHtmlDocument(
    metadataFixture("/unis", { canonical: "https://example.com/unis" }),
  );
  assert.match(routeMetadataFailures(wrongOrigin, "/unis").join("\n"), /canonical/);

  const noindex = parseHtmlDocument(metadataFixture("/legal/privacy", { robots: "noindex" }));
  assert.match(routeMetadataFailures(noindex, "/legal/privacy").join("\n"), /robots/);

  const phantomRoute = "/not-in-release-manifest";
  assert.equal(indexableRoutes.includes(phantomRoute), false);
  assert.equal(routeExpectationFor(phantomRoute, { universities, postRecords: [] }), undefined);

  const homepage = parseHtmlDocument(metadataFixture("/"));
  const notFound = parseHtmlDocument(
    '<!doctype html><html lang="ru"><head><meta name="robots" content="noindex"/><title>Не найдено</title></head><body><main><h1>Страница не найдена</h1><a href="/">На главную</a></main></body></html>',
  );
  assert.doesNotThrow(() => assertIndependent404(notFound, indexableRoutes, universities, homepage));
});

test("validate:release rejects route-matrix metadata drift fixtures", async () => {
  const pricingArtifact = artifactFor("/pricing");
  await releaseFixture(async (root) => {
    const path = join(root, "dist", pricingArtifact);
    const html = await readFile(path, "utf8");
    await writeFile(path, html.replace(/<meta name="description"[^>]*>/, ""), "utf8");
  }, /pricing: description/);

  await releaseFixture(async (root) => {
    const path = join(root, "dist", artifactFor("/changelog"));
    const html = await readFile(path, "utf8");
    await writeFile(
      path,
      html.replace("</head>", '<link rel="canonical" href="https://vuzora.ru/changelog"/></head>'),
      "utf8",
    );
  }, /changelog: canonical/);

  await releaseFixture(async (root) => {
    const path = join(root, "dist", artifactFor("/unis"));
    const html = await readFile(path, "utf8");
    await writeFile(
      path,
      html.replace('href="https://vuzora.ru/unis"', 'href="https://example.com/unis"'),
      "utf8",
    );
  }, /unis: canonical|og:url/);

  await releaseFixture(async (root) => {
    const path = join(root, "dist", artifactFor("/legal/privacy"));
    const html = await readFile(path, "utf8");
    await writeFile(path, html.replace('content="index, follow"', 'content="noindex"'), "utf8");
  }, /legal\/privacy: robots/);

  await releaseFixture(async (root) => {
    const source = join(root, "dist", artifactFor("/pricing"));
    const destination = join(root, "dist", "not-in-release-manifest", "index.html");
    await mkdir(join(destination, ".."), { recursive: true });
    await writeFile(destination, await readFile(source));
  }, /unexpected route HTML artifacts/);
});

test("university CTA order requires one immediate above-content anchor", () => {
  const university = { slug: "msu" };
  const valid = parseHtmlDocument(
    '<header data-identity-status><h1>МГУ</h1><span>Онлайн Москва</span></header>' +
      '<a href="https://t.me/vuzora_bot?start=from-site_msu" data-cta="university-conversion" target="_blank" rel="noopener noreferrer">Подключить</a>' +
      '<div data-detail-content>Контент</div>',
  );
  assert.doesNotThrow(() => assertUniversityCtaOrder(valid, university, "/unis/msu"));

  const misplaced = parseHtmlDocument(
    '<header data-identity-status><h1>МГУ</h1><span>Онлайн Москва</span></header>' +
      '<div data-detail-content>Контент</div>' +
      '<a href="https://t.me/vuzora_bot?start=from-site_msu" data-cta="university-conversion" target="_blank" rel="noopener noreferrer">Подключить</a>',
  );
  assert.throws(
    () => assertUniversityCtaOrder(misplaced, university, "/unis/msu"),
    /does not immediately follow|missing detail-content/,
  );

  const duplicated = parseHtmlDocument(
    '<header data-identity-status><h1>МГУ</h1><span>Онлайн Москва</span></header>' +
      '<a href="https://t.me/vuzora_bot?start=from-site_msu" data-cta="university-conversion" target="_blank" rel="noopener noreferrer">Подключить</a>' +
      '<a href="https://t.me/vuzora_bot?start=from-site_msu" target="_blank" rel="noopener noreferrer">Ещё раз</a>' +
      '<div data-detail-content>Контент</div>',
  );
  assert.throws(
    () => assertUniversityCtaOrder(duplicated, university, "/unis/msu"),
    /contains 2 university-scoped CTAs/,
  );
});

test("manifest is mandatory and field-for-field authoritative", () => {
  assert.throws(
    () =>
      assertManifest(
        { universities: [] },
        { universities: [{ slug: "msu", name: "МГУ" }], posts: [] },
      ),
    /disagrees/,
  );
});

test("parsed route rejects copied or cross-route identity", () => {
  const document = parseHtmlDocument(
    baseHtml(
      '<a href="/">Главная</a><a href="https://t.me/vuzora_bot?start=from-site_other">Открыть</a>',
    ),
  );
  const failures = [];
  validateRouteDocument(
    document,
    "/unis/msu",
    ["/unis/msu"],
    [{ slug: "msu", name: "МГУ", city: "Москва", status: "online" }],
    failures,
  );
  assert.ok(failures.some((failure) => /H1 does not identify|CTA/.test(failure)));
});

test("explicit core route expectations reject copied HTML", () => {
  const copied = parseHtmlDocument(
    baseHtml('<a href="/">Главная</a><a href="/pricing">Тарифы</a>'),
  );
  const failures = [];
  validateRouteDocument(copied, "/pricing", routes, [], failures);
  assert.ok(
    failures.some((failure) => /route-specific title|route-specific H1|JSON-LD/.test(failure)),
  );
});

test("sitemap parser rejects duplicate child fields instead of overwriting", () => {
  assert.throws(
    () =>
      parseSitemapXml(
        "<urlset><url><loc>https://vuzora.ru/</loc><loc>https://vuzora.ru/pricing</loc></url></urlset>",
      ),
    /duplicate sitemap field loc/,
  );
  assert.throws(
    () =>
      parseSitemapXml(
        "<urlset><url><loc>https://vuzora.ru/</loc><lastmod>2026-07-16</lastmod><lastmod>2026-07-17</lastmod></url></urlset>",
      ),
    /duplicate sitemap field lastmod/,
  );
  assert.throws(
    () => parseSitemapXml("<urlset><url><loc></loc><loc></loc></url></urlset>"),
    /duplicate sitemap field loc/,
  );
});

test("invalid UTF-8 bytes remain distinguishable in release hashes", () => {
  const first = Uint8Array.from([0x3c, 0x70, 0x3e, 0xc3, 0x28, 0x3c, 0x2f, 0x70, 0x3e]);
  const second = Uint8Array.from([0x3c, 0x70, 0x3e, 0xe2, 0x28, 0x3c, 0x2f, 0x70, 0x3e]);
  assert.equal(new TextDecoder().decode(first), new TextDecoder().decode(second));
  assert.notEqual(hashReleaseBytes("index.html", first), hashReleaseBytes("index.html", second));
});

test("exact route JSON-LD identities reject identical duplicate subjects", () => {
  const expectation = routeExpectationFor("/changelog", { universities: [] });
  const duplicated = parseHtmlDocument(
    baseHtml(
      '<a href="/">Главная</a>',
      '<script type="application/ld+json">{"@type":"BreadcrumbList","@id":"https://vuzora.ru/changelog#breadcrumb","name":"Что нового – Vuzora","url":"https://vuzora.ru/changelog"}</script>' +
        '<script type="application/ld+json">{"@type":"BreadcrumbList","@id":"https://vuzora.ru/changelog#breadcrumb","name":"Что нового – Vuzora","url":"https://vuzora.ru/changelog"}</script>',
    ),
  );
  const failures = [];
  validateRouteDocument(
    duplicated,
    "/changelog",
    ["/changelog"],
    [],
    failures,
    new Set(),
    new Set(),
    {
      "/changelog": {
        ...expectation,
        title: duplicated.title,
        heading: duplicated.headings[0],
        jsonLdTypes: ["BreadcrumbList"],
      },
    },
  );
  assert.ok(failures.some((failure) => /JSON-LD identity mismatch/.test(failure)));
});

test("exact route JSON-LD identities reject contradictory duplicate subjects", () => {
  const expectation = routeExpectationFor("/changelog", { universities: [] });
  const contradictory = parseHtmlDocument(
    baseHtml(
      '<a href="/">Главная</a>',
      '<script type="application/ld+json">{"@type":"BreadcrumbList","@id":"https://vuzora.ru/changelog#breadcrumb","name":"Что нового – Vuzora","url":"https://vuzora.ru/changelog"}</script>' +
        '<script type="application/ld+json">{"@type":"BreadcrumbList","@id":"https://vuzora.ru/changelog#breadcrumb","name":"Другая страница","url":"https://vuzora.ru/other"}</script>',
    ),
  );
  const failures = [];
  validateRouteDocument(
    contradictory,
    "/changelog",
    ["/changelog"],
    [],
    failures,
    new Set(),
    new Set(),
    {
      "/changelog": {
        ...expectation,
        title: contradictory.title,
        heading: contradictory.headings[0],
        jsonLdTypes: ["BreadcrumbList"],
      },
    },
  );
  assert.ok(failures.some((failure) => /JSON-LD identity mismatch/.test(failure)));
});

test("semantic CTA rules reject confusion, cardinality, and unsafe attributes", () => {
  const expectation = routeExpectationFor("/", { universities: [] });
  const html = baseHtml(
    '<a href="/">Главная</a>' +
      '<a href="https://t.me/vuzora_bot?start=from-site" data-cta="bot-navigation" target="_blank" rel="noopener noreferrer">Wrong marker</a>',
  );
  const failures = [];
  validateRouteDocument(parseHtmlDocument(html), "/", ["/"], [], failures, new Set(), new Set(), {
    "/": {
      ...expectation,
      ctas: [
        { marker: "generic-conversion", href: "https://t.me/vuzora_bot?start=from-site", count: 2 },
      ],
    },
  });
  assert.ok(failures.some((failure) => /data-cta=generic-conversion expected 2/.test(failure)));
  assert.ok(failures.some((failure) => /unexpected data-cta marker bot-navigation/.test(failure)));

  const unsafe = baseHtml(
    '<a href="/">Главная</a><a href="https://t.me/vuzora_bot" data-cta="bot-navigation">Bot</a>',
  );
  const unsafeFailures = [];
  validateRouteDocument(parseHtmlDocument(unsafe), "/pricing", ["/pricing"], [], unsafeFailures);
  assert.ok(
    unsafeFailures.some((failure) => /unsafe external attributes|target=_blank/.test(failure)),
  );
});

test("release hashes preserve raw bytes outside allowed sitemap dates", () => {
  const sitemapA = new TextEncoder().encode(
    "<urlset><url><loc>https://vuzora.ru/</loc><lastmod>2026-07-16</lastmod></url></urlset>",
  );
  const sitemapB = new TextEncoder().encode(
    "<urlset>\n<url><loc>https://vuzora.ru/</loc><lastmod>2026-07-17</lastmod></url></urlset>",
  );
  assert.notDeepEqual(normalizeSitemapLastmodBytes("sitemap.xml", sitemapA), sitemapB);
  assert.notEqual(
    hashReleaseBytes("sitemap.xml", sitemapA),
    hashReleaseBytes("sitemap.xml", sitemapB),
  );

  const htmlA = new TextEncoder().encode("<!doctype html><p>A</p>");
  const htmlB = new TextEncoder().encode("<!doctype html>\n<p>A</p>");
  assert.notEqual(hashReleaseBytes("index.html", htmlA), hashReleaseBytes("index.html", htmlB));
});

test("404 isolation rejects homepage, canonical, and university CTA leakage", () => {
  const homepage = parseHtmlDocument(baseHtml('<a href="/">Главная</a>'));
  const leaking = parseHtmlDocument(
    baseHtml(
      '<a href="/">На главную</a><a href="https://t.me/vuzora_bot?start=from-site_msu">Открыть</a>',
      '<link rel="canonical" href="https://vuzora.ru/"/>',
    ),
  );
  assert.throws(
    () => assertIndependent404(leaking, routes, [{ slug: "msu", name: "МГУ" }], homepage),
    /canonical|CTA|homepage|title|noindex/,
  );
});

test("llms join fails closed on underlist and overlist fixtures", () => {
  const universities = [
    { slug: "msu", code: "МГУ", name: "МГУ имени М. В. Ломоносова" },
    { slug: "hse", code: "ВШЭ", name: "НИУ ВШЭ" },
  ];
  const full = buildLlmsPacket(universities);
  assert.doesNotThrow(() => assertLlmsJoin(full, universities));

  const under = buildLlmsPacket(universities.slice(0, 1));
  assert.throws(() => assertLlmsJoin(under, universities), /underlist|missing/i);

  const over = `${full}\n- Phantom: ${detailUrl("not-a-real-slug")}\n`;
  assert.throws(() => assertLlmsJoin(over, universities), /overlist|phantom/i);
});

test("sitemap parser rejects malformed, duplicate, alternate-origin, and artifact-mismatched locators", () => {
  const valid =
    '<?xml version="1.0"?><urlset><url><loc>https://vuzora.ru/</loc><lastmod>2026-07-16</lastmod></url><url><loc>https://vuzora.ru/pricing</loc></url></urlset>';
  assert.equal(parseSitemapXml(valid).length, 2);
  assert.throws(
    () =>
      assertSitemap(
        valid.replace("https://vuzora.ru/pricing", "https://example.com/pricing"),
        routes,
      ),
    /canonical|route set/,
  );
  assert.throws(
    () =>
      assertSitemap(
        valid.replace("</urlset>", "<url><loc>https://vuzora.ru/</loc></url></urlset>"),
        routes,
      ),
    /duplicate/,
  );
  assert.throws(
    () => assertSitemap(valid, routes, (artifact) => artifact === "index.html"),
    /artifact/,
  );
  assert.throws(
    () => parseSitemapXml("<urlset><url><loc>https://vuzora.ru/</url></urlset>"),
    /malformed|incomplete/,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  assertIndependent404,
  assertManifest,
  validateRouteDocument,
  assertSitemap,
  parseHtmlDocument,
  parseSitemapXml,
} from "./release-validator.mjs";
import { hashReleaseBytes, normalizeSitemapLastmodBytes } from "./compare-release.mjs";

const baseHtml = (body, head = "") =>
  `<!doctype html><html><head><title>Страница Vuzora для проверки</title><meta name="description" content="Достаточно длинное описание страницы Vuzora для детерминированной проверки релизного контракта без заглушек."/><link rel="canonical" href="https://vuzora.ru/test"/><meta property="og:url" content="https://vuzora.ru/test"/><meta property="og:type" content="website"/>${head}</head><body><main><h1>Страница Vuzora для проверки</h1>${body}</main></body></html>`;

const routes = ["/", "/pricing"];

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
    /canonical|CTA|homepage|title/,
  );
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

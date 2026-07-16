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

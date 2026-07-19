/**
 * Representative client-navigation regression for VAL-EDIT-011.
 *
 * Run against the built static validation surface:
 *   bun run build
 *   bun run test:browser:blog-metadata
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const ORIGIN = process.env.VUZORA_ORIGIN ?? "http://127.0.0.1:3100";
const SESSION =
  process.env.AGENT_BROWSER_SESSION ?? `vuzora-blog-metadata-${process.pid}`;
const POST_ROUTE = "/blog/msu-utrenniy-plan";

function browser(args, timeout = 30_000) {
  const output = execFileSync(
    "agent-browser",
    ["--session", SESSION, "--headed", "false", "--json", ...args],
    { encoding: "utf8", timeout },
  );
  const response = JSON.parse(output);
  if (!response.success) throw new Error(response.error ?? output);
  return response.data;
}

function evaluate(expression) {
  const result = browser(["eval", expression]).result;
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

function waitForPage() {
  browser(["wait", "--load", "networkidle"]);
  browser(["wait", "250"], 10_000);
}

function metadataSnapshot() {
  return evaluate(`(() => ({
    path: location.pathname,
    lang: document.documentElement.lang,
    canonical: [...document.querySelectorAll('link[rel="canonical"]')].map((node) => node.href),
    ogUrl: [...document.querySelectorAll('meta[property="og:url"]')].map((node) => node.content),
    ogType: [...document.querySelectorAll('meta[property="og:type"]')].map((node) => node.content),
    locale: [...document.querySelectorAll('meta[property="og:locale"]')].map((node) => node.content),
    published: [...document.querySelectorAll('meta[property="article:published_time"]')].map((node) => node.content),
    modified: [...document.querySelectorAll('meta[property="article:modified_time"]')].map((node) => node.content),
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => JSON.parse(node.textContent)),
  }))()`);
}

function assertSnapshot(snapshot, expectedPath, expectedType) {
  const expectedUrl = `https://vuzora.ru${expectedPath}`;
  assert.equal(snapshot.path, expectedPath);
  assert.equal(snapshot.lang, "ru");
  assert.deepEqual(snapshot.canonical, [expectedUrl]);
  assert.deepEqual(snapshot.ogUrl, [expectedUrl]);
  assert.deepEqual(snapshot.ogType, [expectedType]);
  assert.deepEqual(snapshot.locale, ["ru_RU"]);
}

try {
  browser(["open", `${ORIGIN}/blog/`]);
  browser(["set", "viewport", "390", "844"]);
  waitForPage();
  const index = metadataSnapshot();
  assertSnapshot(index, "/blog/", "website");
  const indexBlog = index.jsonLd.find((node) => node["@type"] === "Blog");
  assert.equal(indexBlog.url, "https://vuzora.ru/blog/");

  browser(["click", `a[href="${POST_ROUTE}"]`]);
  waitForPage();
  const detail = metadataSnapshot();
  assertSnapshot(detail, POST_ROUTE, "article");
  assert.deepEqual(detail.published, ["2026-07-08"]);
  assert.deepEqual(detail.modified, ["2026-07-08"]);
  const posting = detail.jsonLd.find((node) => node["@type"] === "BlogPosting");
  assert.equal(posting.url, "https://vuzora.ru/blog/msu-utrenniy-plan");
  assert.equal(posting.mainEntityOfPage, posting.url);
  const breadcrumb = detail.jsonLd.find((node) => node["@type"] === "BreadcrumbList");
  assert.equal(breadcrumb.itemListElement[1].item, "https://vuzora.ru/blog/");

  console.log(
    JSON.stringify(
      {
        origin: ORIGIN,
        viewport: "390x844",
        checks: ["blog index initial metadata", "index-to-detail client navigation", "article identity"],
        index: { path: index.path, canonical: index.canonical[0], type: index.ogType[0] },
        detail: { path: detail.path, canonical: detail.canonical[0], type: detail.ogType[0] },
      },
      null,
      2,
    ),
  );
} finally {
  try {
    browser(["close"], 10_000);
  } catch {
    // Preserve the primary assertion failure if the runner is already closed.
  }
}

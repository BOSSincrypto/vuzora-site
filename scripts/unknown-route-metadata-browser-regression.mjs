/**
 * Unknown dynamic-route metadata regression.
 *
 * Run against the built static validation surface:
 *   bun run build
 *   bun run test:browser:unknown-route-metadata
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const ORIGIN = process.env.VUZORA_ORIGIN ?? "http://127.0.0.1:3100";
const SESSION =
  process.env.AGENT_BROWSER_SESSION ?? `vuzora-unknown-route-metadata-${process.pid}`;

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
    robots: [...document.querySelectorAll('meta[name="robots"]')].map((node) => node.content),
    canonical: [...document.querySelectorAll('link[rel="canonical"]')].map((node) => node.href),
    alternate: [...document.querySelectorAll('link[rel="alternate"]')].map((node) => node.href),
    ogUrl: [...document.querySelectorAll('meta[property="og:url"]')].map((node) => node.content),
    ogType: [...document.querySelectorAll('meta[property="og:type"]')].map((node) => node.content),
    locale: [...document.querySelectorAll('meta[property="og:locale"]')].map((node) => node.content),
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((node) => JSON.parse(node.textContent || "")),
  }))()`);
}

function normalizeBrowserPath(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function assertSupported(snapshot, expectedPath, expectedType = "website") {
  const expectedUrl = `https://vuzora.ru${expectedPath}`;
  assert.equal(normalizeBrowserPath(snapshot.path), expectedPath);
  assert.deepEqual(snapshot.robots, ["index, follow"]);
  assert.deepEqual(snapshot.canonical, [expectedUrl]);
  assert.deepEqual(snapshot.ogUrl, [expectedUrl]);
  assert.deepEqual(snapshot.ogType, [expectedType]);
  assert.deepEqual(snapshot.locale, ["ru_RU"]);
  assert.deepEqual(snapshot.alternate, [
    "https://vuzora.ru/blog/rss.xml",
    "https://vuzora.ru/llms.txt",
  ]);
  assert.ok(snapshot.jsonLd.length > 0);
}

function assertUnknown(snapshot, expectedPath) {
  assert.equal(normalizeBrowserPath(snapshot.path), expectedPath);
  assert.deepEqual(snapshot.robots, ["noindex"]);
  assert.deepEqual(snapshot.canonical, []);
  assert.deepEqual(snapshot.alternate, []);
  assert.deepEqual(snapshot.ogUrl, []);
  assert.deepEqual(snapshot.ogType, []);
  assert.deepEqual(snapshot.locale, []);
  const routeClassTypes = new Set([
    "Blog",
    "BlogPosting",
    "BreadcrumbList",
    "CollegeOrUniversity",
    "FAQPage",
    "Product",
    "Service",
    "SoftwareApplication",
  ]);
  const leakedRouteNodes = snapshot.jsonLd
    .flatMap((document) => document["@graph"] ?? [document])
    .filter((node) => {
      const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      return types.some((type) => routeClassTypes.has(type));
    });
  assert.deepEqual(leakedRouteNodes, []);
}

async function navigateWithRouter(route, params) {
  evaluate(
    `window.__TSR_ROUTER__.navigate({to:${JSON.stringify(route)},params:${JSON.stringify(params)}}).then(() => "navigated")`,
  );
  browser(["wait", "500"], 10_000);
}

try {
  browser(["open", `${ORIGIN}/unis/msu`]);
  waitForPage();
  assertSupported(metadataSnapshot(), "/unis/msu");

  await navigateWithRouter("/unis/$slug", { slug: "not-a-real-university-xyz" });
  assertUnknown(metadataSnapshot(), "/unis/not-a-real-university-xyz");

  browser(["open", `${ORIGIN}/blog/msu-utrenniy-plan`]);
  waitForPage();
  assertSupported(metadataSnapshot(), "/blog/msu-utrenniy-plan", "article");

  await navigateWithRouter("/blog/$slug", { slug: "not-a-real-post-xyz" });
  assertUnknown(metadataSnapshot(), "/blog/not-a-real-post-xyz");

  browser(["open", `${ORIGIN}/unis/not-a-real-university-direct-xyz`]);
  waitForPage();
  assertUnknown(metadataSnapshot(), "/unis/not-a-real-university-direct-xyz");

  browser(["open", `${ORIGIN}/blog/not-a-real-post-direct-xyz`]);
  waitForPage();
  assertUnknown(metadataSnapshot(), "/blog/not-a-real-post-direct-xyz");

  console.log(
    JSON.stringify(
      {
        origin: ORIGIN,
        checks: [
          "supported university metadata",
          "unknown university client navigation",
          "supported blog metadata",
          "unknown blog client navigation",
          "unknown university direct load",
          "unknown blog direct load",
        ],
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

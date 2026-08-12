import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import negotiation, {
  DISCOVERY_LINK_HEADERS,
  SECURITY_HEADERS,
  mirrorPath,
  mirrorUrl,
  prefersMarkdown,
} from "../edge/markdown-negotiation.mjs";
import { markdownMirrorPath } from "./markdown-artifacts.mjs";
import { buildMarkdownMirrors } from "./markdown-mirrors.mjs";
import { readContentSnapshot } from "./content-snapshot.mjs";

const ORIGIN = "https://vuzora.ru";

/**
 * Run the edge module against a fake origin.
 *
 * `files` maps a path to the Markdown body published there. A `.md` path with
 * no entry answers `404`, the way GitHub Pages answers for a page that has no
 * mirror; every other path answers as the HTML page.
 */
async function serve(path, { accept, method = "GET", files = {} } = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const body = files[url.pathname];
    if (body !== undefined)
      return new Response(body, { status: 200, headers: { "content-type": "text/markdown" } });
    return new Response("<!doctype html><html></html>", {
      status: url.pathname.endsWith(".md") ? 404 : 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  };
  try {
    const headers = accept ? { accept } : {};
    return await negotiation.fetch(new Request(`${ORIGIN}${path}`, { method, headers }));
  } finally {
    globalThis.fetch = original;
  }
}

test("only an explicitly named text/markdown wins the negotiation", () => {
  assert.equal(prefersMarkdown("text/markdown"), true);
  assert.equal(prefersMarkdown("text/markdown, text/html"), true);
  assert.equal(prefersMarkdown("text/markdown;q=0.9, text/html;q=0.8"), true);
  // A browser's default header names HTML and a wildcard, never Markdown.
  assert.equal(
    prefersMarkdown("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
    false,
  );
  assert.equal(prefersMarkdown("text/markdown;q=0, text/html;q=1"), false);
  assert.equal(prefersMarkdown("text/markdown;q=0.2, text/html;q=0.9"), false);
  assert.equal(prefersMarkdown("*/*"), false);
  assert.equal(prefersMarkdown(null), false);
});

test("the edge maps a page to the same mirror the build publishes", () => {
  const mirrors = buildMarkdownMirrors(readContentSnapshot(process.cwd()));
  assert.ok(mirrors.length > 0);
  for (const mirror of mirrors) {
    assert.equal(mirrorPath(mirror.route), markdownMirrorPath(mirror.route), mirror.route);
    assert.equal(mirrorPath(mirror.route), `/${mirror.path}`, mirror.route);
  }
  // Trailing slash is the canonical form, but an agent may drop it.
  assert.equal(mirrorPath("/unis/msu"), "/unis/msu.md");
  // Explicit resources and discovery namespaces have no page mirror.
  assert.equal(mirrorPath("/unis.md"), null);
  assert.equal(mirrorPath("/llms.txt"), null);
  assert.equal(mirrorPath("/assets/app.js"), null);
  assert.equal(mirrorPath("/.well-known/api-catalog"), null);
});

test("a mirror path can never resolve off this origin", () => {
  // `//host` is an authority, not a path: `new URL("//host/x", origin)` is
  // `https://host/x`. A `..` check never sees it, so both the string guard and
  // the resolved-origin check have to reject it — `edge/a2a-agent.mjs` hands
  // `mirrorUrl` a raw client string, and a miss there is a subrequest to
  // somebody else's server, answered in this site's voice.
  for (const escape of [
    "//attacker.example/payload",
    "///attacker.example/payload",
    "////attacker.example/payload",
    "/\\attacker.example/payload",
    "/\\\\attacker.example/payload",
    "//user:pw@attacker.example/payload",
    "//attacker.example/exfil?q=1",
    "/../../etc/passwd",
    "not-a-path",
  ]) {
    assert.equal(mirrorPath(escape), null, escape);
    assert.equal(mirrorUrl(escape, ORIGIN), null, escape);
  }

  // The guard must not cost the site its own pages.
  for (const page of ["/", "/pricing/", "/unis/", "/unis/msu/", "/blog/pochemu-utro/"]) {
    assert.equal(mirrorUrl(page, ORIGIN).origin, ORIGIN, page);
  }
});

test("a negotiated mirror is not served from a shared cache", async () => {
  // `Vary: Accept` only separates representations in a cache that keys on
  // `Accept`; Cloudflare does not by default. Without this, one agent's
  // Markdown request can be replayed to every later browser visitor.
  const response = await serve("/unis/msu/", {
    accept: "text/markdown",
    files: { "/unis/msu.md": "# Расписание МГУ\n" },
  });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("every page the build publishes falls under a deployed worker route", () => {
  // The worker only runs where `wrangler.toml` says it runs. Routes are kept
  // to the public sections rather than `vuzora.ru/*` so assets do not spend
  // the free plan's daily requests — which means a page outside every pattern
  // would answer HTML to an agent with no failure anywhere else to notice.
  const config = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  const patterns = [...config.matchAll(/^\s*pattern\s*=\s*"([^"]+)"/gm)].map((match) => match[1]);
  assert.ok(patterns.length > 0, "wrangler.toml declares no routes");

  const matches = (route) =>
    patterns.some((pattern) =>
      new RegExp(
        `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
      ).test(`vuzora.ru${route}`),
    );

  for (const mirror of buildMarkdownMirrors(readContentSnapshot(process.cwd())))
    assert.ok(matches(mirror.route), `no worker route covers ${mirror.route}`);

  // A matcher that accepts everything would pass the loop above while proving
  // nothing. A section that does not exist yet must not be covered.
  assert.equal(matches("/faq/"), false);
  assert.equal(matches("/assets/app.js"), false);
});

test("an agent asking for Markdown gets the mirror, typed and varied", async () => {
  const response = await serve("/unis/msu/", {
    accept: "text/markdown",
    files: { "/unis/msu.md": "# Расписание МГУ\n" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/markdown; charset=utf-8");
  assert.equal(response.headers.get("vary"), "Accept");
  assert.equal(await response.text(), "# Расписание МГУ\n");
});

test("browsers and non-reads keep the HTML response untouched", async () => {
  const files = { "/unis/msu.md": "# Расписание МГУ\n" };
  for (const request of [
    { accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
    { accept: undefined },
    { accept: "text/markdown;q=0, text/html" },
    { accept: "text/markdown", method: "POST" },
  ]) {
    const response = await serve("/unis/msu/", { files, ...request });
    assert.match(response.headers.get("content-type"), /^text\/html\b/);
    assert.equal(response.headers.get("vary"), null);
  }
});

test("every relation is registered and every target is published", () => {
  // RFC 8288 serialization: an angle-bracketed URI reference, then a quoted
  // `rel`. A relation outside this set, or a target the release does not
  // publish, would advertise a capability that does not exist.
  const registered = new Set(["api-catalog", "service-doc", "describedby"]);
  assert.equal(DISCOVERY_LINK_HEADERS.length, registered.size);

  for (const field of DISCOVERY_LINK_HEADERS) {
    const match = /^<(\/[^>]*)>; rel="([a-z-]+)"$/.exec(field);
    assert.ok(match, `not an RFC 8288 link field: ${field}`);
    const [, target, relation] = match;
    assert.ok(registered.delete(relation), `unexpected or repeated relation: ${relation}`);
    assert.ok(
      existsSync(new URL(`../public${target}`, import.meta.url)),
      `no published file at ${target}`,
    );
  }
  assert.equal(registered.size, 0);
});

test("both representations carry the discovery links", async () => {
  const files = { "/index.md": "# Vuzora\n" };
  for (const request of [
    { accept: "text/markdown" },
    { accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
    { accept: undefined },
    { accept: "text/markdown", method: "HEAD" },
  ]) {
    const response = await serve("/", { files, ...request });
    // A repeated field arrives comma-joined; either form is valid RFC 8288.
    const link = response.headers.get("link");
    for (const field of DISCOVERY_LINK_HEADERS)
      assert.ok(link?.includes(field), `${JSON.stringify(request)} lost ${field}`);
  }
});

test("every representation carries the baseline security headers", async () => {
  const files = { "/index.md": "# Vuzora\n" };
  for (const request of [
    { accept: "text/markdown" },
    { accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
  ]) {
    const response = await serve("/", { files, ...request });
    for (const [name, value] of Object.entries(SECURITY_HEADERS))
      assert.equal(response.headers.get(name), value, name);
  }
});

test("a security header the origin already set is left alone", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("<!doctype html><html></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "x-frame-options": "SAMEORIGIN" },
    });
  try {
    const response = await negotiation.fetch(new Request(`${ORIGIN}/`));
    assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
  } finally {
    globalThis.fetch = original;
  }
});

test("a route without a mirror falls back to its HTML page", async () => {
  const response = await serve("/unis/msu/", { accept: "text/markdown" });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html\b/);
  assert.match(await response.text(), /<html/);
});

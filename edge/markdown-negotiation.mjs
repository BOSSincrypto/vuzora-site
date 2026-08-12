/**
 * The response-header jobs GitHub Pages cannot do: `Accept: text/markdown`
 * content negotiation, RFC 8288 `Link` headers for agent discovery, and
 * baseline security headers on every response.
 *
 * GitHub Pages serves committed files and cannot select a representation from
 * `Accept`. The release already publishes a Markdown mirror of every public
 * page under the convention agents probe — the page path, minus the trailing
 * slash, plus `.md` — so negotiation is a routing decision, not a conversion:
 * an agent that asks for Markdown gets the curated mirror, and a browser gets
 * the untouched HTML response.
 *
 * It also cannot emit a response header at all, which is why the discovery
 * relations and the security headers below travel here rather than in the
 * origin artifact. Every response this edge returns carries them; the HTML
 * `<link rel="api-catalog">` in `src/content/seo.ts` remains the
 * serialization a browser can see, and `SECURITY_HEADERS` in `src/start.ts`
 * remains the serialization `vite dev`/`vite preview` can see — that
 * middleware never reaches the deployed GitHub Pages artifact, so this
 * Worker is the only place that actually headers production.
 *
 * This file is a Cloudflare Snippet / Worker module. It is **not deployed by
 * this repository** — GitHub Pages cannot run it. Installing it is the
 * operator step in sections 1 and 3 of `AGENT-DISCOVERY-EDGE-RUNBOOK.md`.
 *
 * Deliberately absent: `x-markdown-tokens`. Nothing here counts tokens, and
 * the runbook forbids emitting a header the edge did not actually compute.
 *
 * @module edge/markdown-negotiation
 */

const MARKDOWN_TYPE = "text/markdown";
const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

// Paths that are already an explicit resource (`/unis.md`, `/llms.txt`,
// `/assets/app.js`) or a discovery namespace with its own media types. They
// have no page mirror, so probing for one would be a pointless subrequest.
const PASSTHROUGH_RE = /^\/(?:assets\/|\.well-known\/)|\.[a-z0-9]+$/i;

/**
 * Discovery relations advertised on every response this edge returns.
 *
 * Registered relations only — `api-catalog` by RFC 9727, `service-doc` by
 * RFC 8631, `describedby` by the IANA registry — and each target is a real
 * file the release publishes. `service-desc` is deliberately absent: no
 * machine-readable service description exists, and the catalog these point at
 * says plainly that Vuzora implements no HTTP API. A header naming a target
 * the release does not publish would be a fabricated capability, so
 * `scripts/markdown-negotiation.test.mjs` fails when one goes missing.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8288
 * @see https://www.rfc-editor.org/rfc/rfc9727#section-3
 */
export const DISCOVERY_LINK_HEADERS = [
  '</.well-known/api-catalog>; rel="api-catalog"',
  '</auth.md>; rel="service-doc"',
  '</llms.txt>; rel="describedby"',
];

/**
 * The same response, plus the discovery `Link` fields.
 *
 * One field per relation. RFC 8288 allows a comma-separated value too, but
 * separate fields keep each target's parameters unambiguous, and appending
 * leaves any `Link` the origin sent in place.
 *
 * @param {Response} response
 */
function withDiscoveryLinks(response) {
  const linked = new Response(response.body, response);
  for (const value of DISCOVERY_LINK_HEADERS) linked.headers.append("link", value);
  return linked;
}

/**
 * Baseline security response headers, mirroring `SECURITY_HEADERS` in
 * `src/start.ts`. That middleware only ever reaches `vite dev`/`vite
 * preview`, never the deployed GitHub Pages artifact — so without this,
 * production ships with no clickjacking or content-injection defense at all.
 *
 * `script-src`/`style-src` allow `'unsafe-inline'` for the same reason
 * `src/start.ts` does: the inline bootstrap `<script>` in `src/routes/
 * __root.tsx` and Tailwind v4's inlined styles both need it.
 */
export const SECURITY_HEADERS = {
  // Without this, the first plaintext request to `http://vuzora.ru/...` — a
  // typed URL, an old link, a QR code — is strippable by an on-path attacker,
  // because the browser has never been told this origin is HTTPS-only.
  "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "geolocation=(), microphone=(), camera=(), payment=()",
  "content-security-policy": [
    "default-src 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' mailto:",
  ].join("; "),
};

/**
 * The same response, plus the baseline security headers — set only where the
 * origin has not already set one, so an origin-level change is never
 * silently overridden.
 *
 * @param {Response} response
 */
function withSecurityHeaders(response) {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!secured.headers.has(name)) secured.headers.set(name, value);
  }
  return secured;
}

/**
 * Quality value an `Accept` header assigns to an explicitly named media type.
 *
 * Explicitly named only: the wildcard range a browser sends at `q=0.8` must
 * not be read as a request for Markdown, so wildcards never match here.
 *
 * @param {string} accept Raw `Accept` header value.
 * @param {string} type Media type to look for, e.g. `text/markdown`.
 * @returns {number} Quality in `[0, 1]`; `0` when the type is not named.
 */
export function quality(accept, type) {
  let best = 0;
  for (const entry of String(accept ?? "").split(",")) {
    const [range, ...parameters] = entry.split(";").map((part) => part.trim());
    if (range.toLowerCase() !== type) continue;
    const q = parameters
      .map((parameter) => /^q=(.*)$/i.exec(parameter)?.[1])
      .find((value) => value !== undefined);
    const value = q === undefined ? 1 : Number.parseFloat(q);
    best = Math.max(best, Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0);
  }
  return best;
}

/**
 * Whether this request asked for the Markdown representation.
 *
 * Markdown wins only when the client named it and did not prefer HTML above
 * it, so `text/markdown;q=0, text/html` stays HTML. A tie goes to Markdown:
 * the client named a type the site can serve exactly, and RFC 9110 leaves the
 * choice to the server.
 *
 * @param {string} accept
 */
export function prefersMarkdown(accept) {
  const markdown = quality(accept, MARKDOWN_TYPE);
  return markdown > 0 && markdown >= quality(accept, "text/html");
}

/**
 * Mirror path for a page path, or `null` when the path is not a page.
 *
 * The twin of `markdownMirrorPath` in `scripts/markdown-artifacts.mjs` and
 * `src/content/seo.ts`; `scripts/markdown-negotiation.test.mjs` pins them
 * together so the edge cannot drift from what the build publishes.
 *
 * @param {string} pathname
 */
export function mirrorPath(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return null;
  // A leading `//` or `/\` is an *authority*, not a path: `new URL("//host/x",
  // origin)` resolves to `https://host/x`. Both callers resolve this return
  // value against an origin and `edge/a2a-agent.mjs` passes a raw client
  // string, so rejecting the authority forms here is what keeps a subrequest
  // from leaving the origin. WHATWG reads `\` as `/` in a special scheme.
  if (pathname.includes("\\")) return null;
  if (/^\/{2,}/.test(pathname)) return null;
  if (pathname.includes("..")) return null;
  if (PASSTHROUGH_RE.test(pathname)) return null;
  if (pathname === "/") return "/index.md";
  return `${pathname.replace(/\/+$/, "")}.md`;
}

/**
 * The mirror URL for a page path, or `null` when it would leave the origin.
 *
 * `mirrorPath` filters strings; this resolves one and asks the URL parser
 * whether the answer is still this origin. The parser is the authority on what
 * a string means, so a form the filter did not anticipate is caught here
 * instead of becoming a subrequest to somebody else's server.
 *
 * @param {string} pathname
 * @param {string} origin
 * @returns {URL | null}
 */
export function mirrorUrl(pathname, origin) {
  const path = mirrorPath(pathname);
  if (!path) return null;
  const target = new URL(path, origin);
  return target.origin === new URL(origin).origin ? target : null;
}

export default {
  /**
   * @param {Request} request
   */
  async fetch(request) {
    return withSecurityHeaders(withDiscoveryLinks(await represent(request)));
  },
};

/**
 * The representation this request asked for: the Markdown mirror when the
 * client named `text/markdown` and one exists, the origin response otherwise.
 *
 * @param {Request} request
 */
async function represent(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return fetch(request);
  if (!prefersMarkdown(request.headers.get("accept"))) return fetch(request);

  const url = new URL(request.url);
  // Query strings do not select content on a static site; dropping them
  // keeps every agent on one cache entry per mirror.
  const mirror = mirrorUrl(url.pathname, url.origin);
  if (!mirror) return fetch(request);

  const response = await fetch(new Request(mirror, { method: request.method }));

  // No mirror (a 404, a redirect, an origin error) means this route has no
  // Markdown representation. Serve the page the browser would have got.
  if (response.status !== 200) return fetch(request);

  // Built from scratch, not copied from the subrequest. Forwarding the
  // origin's header set would let anything the mirror fetch reaches put
  // `set-cookie`, a weaker `content-security-policy`, or its own caching
  // directives on a response the browser attributes to this origin.
  const headers = new Headers({
    "content-type": MARKDOWN_CONTENT_TYPE,
    // `Vary: Accept` only separates the HTML and Markdown representations in a
    // shared cache that keys on `Accept`, which Cloudflare does not do by
    // default. Until the zone's cache rule says otherwise, keeping the
    // negotiated response out of shared caches is what stops one agent's
    // Markdown request from being replayed to every later browser visitor.
    "cache-control": "private, no-store",
    vary: "Accept",
  });
  return new Response(response.body, { status: 200, headers });
}

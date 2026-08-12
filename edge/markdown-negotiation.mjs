/**
 * The two response-header jobs GitHub Pages cannot do: `Accept: text/markdown`
 * content negotiation, and RFC 8288 `Link` headers for agent discovery.
 *
 * GitHub Pages serves committed files and cannot select a representation from
 * `Accept`. The release already publishes a Markdown mirror of every public
 * page under the convention agents probe — the page path, minus the trailing
 * slash, plus `.md` — so negotiation is a routing decision, not a conversion:
 * an agent that asks for Markdown gets the curated mirror, and a browser gets
 * the untouched HTML response.
 *
 * It also cannot emit a response header at all, which is why the discovery
 * relations below travel here rather than in the origin artifact. Every
 * response this edge returns carries them; the HTML `<link rel="api-catalog">`
 * in `src/content/seo.ts` remains the serialization a browser can see.
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
  if (!pathname.startsWith("/") || pathname.includes("..")) return null;
  if (PASSTHROUGH_RE.test(pathname)) return null;
  if (pathname === "/") return "/index.md";
  return `${pathname.replace(/\/+$/, "")}.md`;
}

export default {
  /**
   * @param {Request} request
   */
  async fetch(request) {
    return withDiscoveryLinks(await represent(request));
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
  const path = mirrorPath(url.pathname);
  if (!path) return fetch(request);

  // Query strings do not select content on a static site; dropping them
  // keeps every agent on one cache entry per mirror.
  const mirror = new URL(path, url.origin);
  const response = await fetch(new Request(mirror, { method: request.method }));

  // No mirror (a 404, a redirect, an origin error) means this route has no
  // Markdown representation. Serve the page the browser would have got.
  if (response.status !== 200) return fetch(request);

  const headers = new Headers(response.headers);
  headers.set("content-type", MARKDOWN_CONTENT_TYPE);
  headers.set("vary", "Accept");
  return new Response(response.body, { status: 200, headers });
}

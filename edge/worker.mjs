/**
 * The deployed Worker entry: one script, two jobs on disjoint paths.
 *
 * `edge/markdown-negotiation.mjs` handles the public pages — `Accept:
 * text/markdown` negotiation and the RFC 8288 discovery `Link` headers — and
 * `edge/a2a-agent.mjs` answers the A2A JSON-RPC interface the Agent Card
 * names. They are separate modules because they answer to separate
 * specifications; they share one deployment because Cloudflare bills per
 * request, not per route, and a second Worker would double the operator steps
 * for no gain.
 *
 * The A2A path is dispatched before the page pipeline and returns its own
 * response untouched. A JSON-RPC reply is a protocol message, not a
 * representation of a page, so the page discovery `Link` fields would be noise
 * on it — and the pipeline's fallback (`fetch(request)`) would send a POST to
 * GitHub Pages, which has nothing at that path.
 *
 * Not deployed by this repository. See `AGENT-DISCOVERY-EDGE-RUNBOOK.md`.
 *
 * @module edge/worker
 */

import a2a, { A2A_PATH } from "./a2a-agent.mjs";
import negotiation from "./markdown-negotiation.mjs";

/**
 * Whether a path belongs to the A2A interface.
 *
 * The exact path and its subpaths only. The Worker route in `wrangler.toml`
 * is `vuzora.ru/a2a/*`, which is wider than this, so anything else under
 * `/a2a/` falls through to the origin rather than being answered by an
 * endpoint that does not implement it.
 *
 * @param {string} pathname
 */
export function isA2APath(pathname) {
  return pathname === A2A_PATH || pathname.startsWith(`${A2A_PATH}/`);
}

export default {
  /**
   * @param {Request} request
   */
  async fetch(request) {
    if (isA2APath(new URL(request.url).pathname)) return a2a.fetch(request);
    return negotiation.fetch(request);
  },
};

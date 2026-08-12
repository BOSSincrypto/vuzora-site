/**
 * The A2A JSON-RPC binding for Vuzora's published catalogue.
 *
 * An Agent Card is a promise that something answers at
 * `supportedInterfaces[].url`. GitHub Pages serves committed files and cannot
 * answer a POST, so publishing the card without this handler would advertise a
 * capability the site does not have — the one thing `AGENTS.md` forbids. This
 * module is that endpoint, and it is deliberately the smallest one the
 * specification permits: `SendMessage`, no tasks, no streaming, no push, no
 * authentication.
 *
 * Nothing here invents an answer. Every reply is read back out of an artifact
 * the release already publishes — the catalogue at `/unis.md` and the Markdown
 * mirrors — so the agent can only say what the site already says in public.
 * That is also why it needs no state: two skills, at most two subrequests, and
 * the origin remains the single source of truth.
 *
 * Like `edge/markdown-negotiation.mjs`, this file is **not deployed by this
 * repository**. Installing it is the operator step in section 4 of
 * `AGENT-DISCOVERY-EDGE-RUNBOOK.md`, and it must be deployed *before* the card
 * reaches production, or the card names a URL that answers 404.
 *
 * @see https://a2a-protocol.org/latest/specification/
 * @module edge/a2a-agent
 */

import { mirrorUrl } from "./markdown-negotiation.mjs";

/** Path the Agent Card names as the JSON-RPC interface. */
export const A2A_PATH = "/a2a/v1";
/** Protocol binding label from the specification's method-mapping table. */
export const A2A_PROTOCOL_BINDING = "JSONRPC";
/** A2A protocol version this interface exposes. */
export const A2A_PROTOCOL_VERSION = "1.0";
export const A2A_CONTENT_TYPE = "application/json";

const CATALOGUE_PATH = "/unis.md";
const CATALOGUE_URL = "https://vuzora.ru/unis/";

// A JSON-RPC body this size is already far past anything the two skills can
// use. Capping it keeps a single request from spending the free plan's budget
// on a body the handler would only throw away.
const MAX_REQUEST_BYTES = 16 * 1024;

/**
 * Operations the A2A service defines that this agent does not implement.
 *
 * They answer `UnsupportedOperationError` rather than "method not found":
 * the method exists in the protocol, and the card already declares
 * `streaming: false` and `pushNotifications: false`. Telling a client the
 * method is unknown would misdescribe why it failed.
 *
 * @see https://a2a-protocol.org/latest/specification/#53-method-mapping-reference
 */
const UNSUPPORTED_METHODS = new Set([
  "SendStreamingMessage",
  "GetTask",
  "ListTasks",
  "CancelTask",
  "SubscribeToTask",
  "CreateTaskPushNotificationConfig",
  "GetTaskPushNotificationConfig",
  "ListTaskPushNotificationConfigs",
  "DeleteTaskPushNotificationConfig",
  "GetExtendedAgentCard",
]);

/** JSON-RPC 2.0 codes plus the A2A range from specification section 5.4. */
export const ERROR = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  unsupportedOperation: -32004,
  contentTypeNotSupported: -32005,
};

// `- **МГУ** — Московский государственный университет…, Москва — [страница](/unis/msu/)`
const CATALOGUE_ENTRY_RE =
  /^- \*\*(?<code>[^*]+)\*\* — (?<name>[^—]+) — \[[^\]]*\]\((?<route>\/unis\/(?<slug>[a-z0-9-]+)\/)\)\s*$/gmu;

/**
 * Catalogue rows parsed out of the published `/unis.md`.
 *
 * The Markdown is generated from `src/content`, so this is a read of the
 * release rather than a second copy of the registry; a university that is not
 * published is a university this agent cannot name.
 *
 * @param {string} markdown
 */
export function parseCatalogue(markdown) {
  return [...String(markdown ?? "").matchAll(CATALOGUE_ENTRY_RE)].map((match) => ({
    code: match.groups.code.trim(),
    name: match.groups.name.trim(),
    route: match.groups.route,
    slug: match.groups.slug,
  }));
}

/**
 * Search terms to try for one free-text query, most specific first.
 *
 * A client may send a bare slug (`msu`), an abbreviation (`МГУ`), or a
 * sentence (`is HSE covered?`). Splitting on non-letters lets the sentence
 * reach the same exact match as the bare term without any of it being a guess
 * about what the client meant.
 *
 * @param {string} query
 */
function searchTerms(query) {
  const trimmed = query.trim().toLowerCase();
  const tokens = trimmed.split(/[^\p{L}\p{N}-]+/u).filter((token) => token.length >= 2);
  return [trimmed, ...tokens].filter((term) => term.length >= 2);
}

/**
 * The catalogue row a query names, or `null`.
 *
 * Exact slug and code matches are taken across every term before any
 * substring match is considered, so `msu` cannot lose to a longer name that
 * happens to contain those letters.
 *
 * @param {ReturnType<typeof parseCatalogue>} entries
 * @param {string} query
 */
export function findUniversity(entries, query) {
  const terms = searchTerms(query);
  for (const term of terms) {
    const exact = entries.find(
      (entry) => entry.slug === term || entry.code.toLowerCase() === term,
    );
    if (exact) return exact;
  }
  for (const term of terms) {
    if (term.length < 3) continue;
    const partial = entries.find((entry) => entry.name.toLowerCase().includes(term));
    if (partial) return partial;
  }
  return null;
}

/**
 * The text an A2A `Message` carries, or `null` when it carries none.
 *
 * Only `text` parts are read. A client that sends a file or structured data
 * gets `ContentTypeNotSupportedError`, which is what the card's
 * `defaultInputModes` already told it to expect.
 *
 * @param {unknown} message
 */
export function messageText(message) {
  if (!message || typeof message !== "object") return null;
  const { parts } = /** @type {{ parts?: unknown }} */ (message);
  if (!Array.isArray(parts)) return null;
  const text = parts
    .filter((part) => part && typeof part === "object" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
  return text || null;
}

/**
 * An agent `Message` in the JSON binding's field naming.
 *
 * @param {string} text
 * @param {string} mediaType
 */
function agentMessage(text, mediaType) {
  return {
    messageId: crypto.randomUUID(),
    role: "ROLE_AGENT",
    parts: [{ text, mediaType }],
  };
}

class RpcError extends Error {
  /**
   * @param {number} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * The Markdown mirror for a site path the client asked about.
 *
 * `query` is a raw client string, so this is the one place in either edge
 * module where an unfiltered value reaches a URL. `mirrorUrl` both applies the
 * negotiation edge's path guard and re-checks the resolved origin, so a
 * traversal attempt, an authority (`//host`, `/\host`), or a non-page path is
 * rejected and this endpoint can only ever read a published page of this
 * origin.
 *
 * @param {string} query
 * @param {string} origin
 */
async function respondWithMirror(query, origin) {
  const target = mirrorUrl(query, origin);
  if (!target) throw new RpcError(ERROR.invalidParams, `No Vuzora page corresponds to ${query}`);
  const response = await fetch(target);
  if (response.status !== 200)
    return agentMessage(`Vuzora publishes no Markdown mirror for ${query}.`, "text/plain");
  return agentMessage(await response.text(), "text/markdown");
}

/**
 * The catalogue answer for a free-text query.
 *
 * A university the catalogue does not list is a plain answer, not an error:
 * "not published" is a true and useful thing for the agent to say.
 *
 * @param {string} query
 * @param {string} origin
 */
async function respondWithUniversity(query, origin) {
  const catalogue = await fetch(new URL(CATALOGUE_PATH, origin));
  if (catalogue.status !== 200)
    throw new RpcError(ERROR.invalidParams, "The published catalogue is unavailable");
  const entry = findUniversity(parseCatalogue(await catalogue.text()), query);
  if (!entry)
    return agentMessage(
      `Vuzora publishes no page for «${query}». The published catalogue is ${CATALOGUE_URL}`,
      "text/plain",
    );
  const page = await fetch(new URL(`${entry.route.replace(/\/$/, "")}.md`, origin));
  if (page.status !== 200)
    return agentMessage(
      `${entry.code} — ${entry.name}: ${new URL(entry.route, origin).href}`,
      "text/plain",
    );
  return agentMessage(await page.text(), "text/markdown");
}

/**
 * `SendMessage`: the agent's only implemented operation.
 *
 * A query beginning with `/` selects the Markdown-mirror skill; anything else
 * is a catalogue lookup. Both read the origin and neither writes anything,
 * which is why no task is created and the response carries a `message`.
 *
 * @param {unknown} params
 * @param {string} origin
 */
export async function sendMessage(params, origin) {
  if (!params || typeof params !== "object")
    throw new RpcError(ERROR.invalidParams, "SendMessage requires a message");
  const { message } = /** @type {{ message?: { contextId?: unknown } }} */ (params);
  const query = messageText(message);
  if (!query)
    throw new RpcError(ERROR.contentTypeNotSupported, "This agent reads text parts only");
  const contextId = typeof message?.contextId === "string" ? message.contextId : undefined;
  const reply = query.startsWith("/")
    ? await respondWithMirror(query, origin)
    : await respondWithUniversity(query, origin);
  return { message: { ...reply, ...(contextId ? { contextId } : {}) } };
}

/**
 * The request body as text, or `null` once it passes `limit` bytes.
 *
 * `request.text()` buffers whatever the client sends before anything can be
 * measured, which is the spend `MAX_REQUEST_BYTES` exists to prevent — and a
 * client that omits `content-length` skips the declared-size check entirely.
 * Reading through the stream stops at the cap instead of after it.
 *
 * @param {Request} request
 * @param {number} limit
 * @returns {Promise<string | null>}
 */
async function readCapped(request, limit) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/** @param {unknown} body */
function json(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": A2A_CONTENT_TYPE, "cache-control": "no-store" },
  });
}

/**
 * @param {unknown} id
 * @param {number} code
 * @param {string} message
 */
function rpcError(id, code, message) {
  return json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

export default {
  /**
   * @param {Request} request
   */
  async fetch(request) {
    if (request.method !== "POST")
      return new Response(null, { status: 405, headers: { allow: "POST" } });

    // The declared size rejects the honest oversized client before a byte is
    // read. It is only an early-out: `content-length` is absent under chunked
    // encoding and a client is free to lie, so the read below is what actually
    // enforces the cap.
    const declared = Number.parseInt(request.headers.get("content-length") ?? "", 10);
    if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES)
      return rpcError(null, ERROR.invalidRequest, "Request body is too large");

    const text = await readCapped(request, MAX_REQUEST_BYTES);
    if (text === null)
      return rpcError(null, ERROR.invalidRequest, "Request body is too large");

    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return rpcError(null, ERROR.parse, "Request body is not valid JSON");
    }

    if (!body || typeof body !== "object" || Array.isArray(body) || body.jsonrpc !== "2.0")
      return rpcError(null, ERROR.invalidRequest, "Not a JSON-RPC 2.0 request");

    // A request without `id` is a notification: JSON-RPC forbids a response
    // body, and neither operation here has a side effect worth performing for
    // a client that has said it will not read the answer.
    if (body.id === undefined) return new Response(null, { status: 204 });

    if (typeof body.method !== "string")
      return rpcError(body.id, ERROR.invalidRequest, "Request method is missing");
    if (UNSUPPORTED_METHODS.has(body.method))
      return rpcError(
        body.id,
        ERROR.unsupportedOperation,
        `This agent does not implement ${body.method}`,
      );
    if (body.method !== "SendMessage")
      return rpcError(body.id, ERROR.methodNotFound, `Unknown method ${body.method}`);

    try {
      const result = await sendMessage(body.params, new URL(request.url).origin);
      return json({ jsonrpc: "2.0", id: body.id, result });
    } catch (error) {
      if (error instanceof RpcError) return rpcError(body.id, error.code, error.message);
      throw error;
    }
  },
};

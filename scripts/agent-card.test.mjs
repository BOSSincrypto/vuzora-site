import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import worker from "../edge/worker.mjs";
import { A2A_PATH, ERROR, findUniversity, parseCatalogue } from "../edge/a2a-agent.mjs";
import {
  AGENT_CARD_INTERFACE_URL,
  AGENT_CARD_MEDIA_TYPE,
  AGENT_CARD_PATH,
  assertAgentCard,
  assertAgentCardMediaType,
  buildAgentCard,
  serializeAgentCard,
} from "./agent-card.mjs";

const ORIGIN = "https://vuzora.ru";
const CATALOGUE = [
  "## Каталог (2)",
  "",
  "- **МГУ** — Московский государственный университет им. М. В. Ломоносова, Москва — [страница](/unis/msu/)",
  "- **ВШЭ** — Национальный исследовательский университет «Высшая школа экономики», Москва — [страница](/unis/hse/)",
  "",
].join("\n");

/**
 * Run the deployed entry against a fake origin.
 *
 * `files` maps an origin path to its body; anything else answers `404`, the
 * way GitHub Pages answers for a file the release does not publish.
 */
async function call(body, { files = {}, method = "POST", path = A2A_PATH } = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const published = files[url.pathname];
    return published === undefined
      ? new Response("not found", { status: 404 })
      : new Response(published, { status: 200 });
  };
  try {
    return await worker.fetch(
      new Request(`${ORIGIN}${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "POST" && body !== undefined ? JSON.stringify(body) : undefined,
      }),
    );
  } finally {
    globalThis.fetch = original;
  }
}

const send = (text, id = 1) => ({
  jsonrpc: "2.0",
  id,
  method: "SendMessage",
  params: { message: { messageId: "m-1", role: "ROLE_USER", parts: [{ text }] } },
});

test("the published card is what the generator produces", () => {
  const published = readFileSync(new URL(`../public${AGENT_CARD_PATH}`, import.meta.url), "utf8");
  assert.equal(published, serializeAgentCard());
  assert.deepEqual(JSON.parse(published), assertAgentCard(buildAgentCard()));
});

test("the card carries every field the specification requires", () => {
  const card = buildAgentCard();
  for (const field of [
    "name",
    "description",
    "supportedInterfaces",
    "version",
    "capabilities",
    "defaultInputModes",
    "defaultOutputModes",
    "skills",
  ])
    assert.ok(card[field] !== undefined, `missing ${field}`);
  assert.deepEqual(card.supportedInterfaces, [
    { url: AGENT_CARD_INTERFACE_URL, protocolBinding: "JSONRPC", protocolVersion: "1.0" },
  ]);
  for (const skill of card.skills)
    for (const field of ["id", "name", "description", "tags"])
      assert.ok(skill[field] !== undefined, `${skill.id} missing ${field}`);
  assert.equal(assertAgentCardMediaType("application/json; charset=utf-8"), AGENT_CARD_MEDIA_TYPE);
});

test("the card cannot claim more than the endpoint implements", () => {
  // Each of these is a capability `edge/a2a-agent.mjs` answers
  // `UnsupportedOperationError` for, or a target the release does not publish.
  const overclaims = [
    { capabilities: { streaming: true, pushNotifications: false, extendedAgentCard: false } },
    {
      supportedInterfaces: [
        { url: `${ORIGIN}/agent`, protocolBinding: "JSONRPC", protocolVersion: "1.0" },
      ],
    },
    {
      supportedInterfaces: [
        { url: AGENT_CARD_INTERFACE_URL, protocolBinding: "GRPC", protocolVersion: "1.0" },
      ],
    },
    { documentationUrl: "https://example.com/docs" },
    { securitySchemes: { bearer: {} } },
    { skills: [] },
    { skills: [{ id: "no-tags", name: "No tags", description: "…", tags: [] }] },
  ];
  for (const overclaim of overclaims)
    assert.throws(
      () => assertAgentCard({ ...buildAgentCard(), ...overclaim }),
      JSON.stringify(overclaim),
    );
});

test("the interface the card names falls under a deployed worker route", () => {
  // The origin has nothing at this path. Without a matching route the card
  // advertises a URL that answers 404, which is the failure the whole
  // endpoint exists to prevent.
  const config = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  const patterns = [...config.matchAll(/^\s*pattern\s*=\s*"([^"]+)"/gm)].map((match) => match[1]);
  const matches = (route) =>
    patterns.some((pattern) =>
      new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(
        `vuzora.ru${route}`,
      ),
    );
  assert.ok(matches(A2A_PATH), `no worker route covers ${A2A_PATH}`);
  assert.equal(matches("/a2b/v1"), false);
  assert.equal(new URL(AGENT_CARD_INTERFACE_URL).pathname, A2A_PATH);
});

test("the catalogue is read out of the published Markdown", () => {
  const entries = parseCatalogue(CATALOGUE);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], {
    code: "МГУ",
    name: "Московский государственный университет им. М. В. Ломоносова, Москва",
    route: "/unis/msu/",
    slug: "msu",
  });
  // Slug, abbreviation, and a sentence all reach the same published row.
  for (const query of ["msu", "МГУ", "расписание МГУ на завтра"])
    assert.equal(findUniversity(entries, query)?.slug, "msu", query);
  assert.equal(findUniversity(entries, "hse")?.slug, "hse");
  assert.equal(findUniversity(entries, "Оксфорд"), null);
});

test("SendMessage answers with the published page", async () => {
  const response = await call(send("МГУ"), {
    files: { "/unis.md": CATALOGUE, "/unis/msu.md": "# Расписание МГУ\n" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json");
  const body = await response.json();
  assert.equal(body.jsonrpc, "2.0");
  assert.equal(body.id, 1);
  assert.equal(body.result.message.role, "ROLE_AGENT");
  assert.equal(body.result.message.parts[0].text, "# Расписание МГУ\n");
  assert.equal(body.result.message.parts[0].mediaType, "text/markdown");
});

test("a university the catalogue omits is an answer, not an error", async () => {
  const body = await (await call(send("Оксфорд"), { files: { "/unis.md": CATALOGUE } })).json();
  assert.equal(body.error, undefined);
  assert.match(body.result.message.parts[0].text, /publishes no page/);
});

test("a path query returns the mirror and cannot escape the origin", async () => {
  const files = { "/unis.md": CATALOGUE, "/pricing.md": "# Тарифы\n" };
  const ok = await (await call(send("/pricing/"), { files })).json();
  assert.equal(ok.result.message.parts[0].text, "# Тарифы\n");

  // `mirrorPath` rejects traversal, so no subrequest can leave the origin.
  const escape = await (await call(send("/../../etc/passwd"), { files })).json();
  assert.equal(escape.error.code, ERROR.invalidParams);
});

test("unimplemented operations say so precisely", async () => {
  const unsupported = await (
    await call({ jsonrpc: "2.0", id: 2, method: "SendStreamingMessage", params: {} })
  ).json();
  assert.equal(unsupported.error.code, ERROR.unsupportedOperation);

  const unknown = await (await call({ jsonrpc: "2.0", id: 3, method: "Nope" })).json();
  assert.equal(unknown.error.code, ERROR.methodNotFound);

  const nonText = await (
    await call({
      jsonrpc: "2.0",
      id: 4,
      method: "SendMessage",
      params: { message: { parts: [{ url: "https://vuzora.ru/icon-192.png" }] } },
    })
  ).json();
  assert.equal(nonText.error.code, ERROR.contentTypeNotSupported);
});

test("malformed and non-POST requests are refused without reaching the origin", async () => {
  const notJson = await worker.fetch(
    new Request(`${ORIGIN}${A2A_PATH}`, { method: "POST", body: "{" }),
  );
  assert.equal((await notJson.json()).error.code, ERROR.parse);

  const notRpc = await (await call({ id: 5, method: "SendMessage" })).json();
  assert.equal(notRpc.error.code, ERROR.invalidRequest);

  const get = await call(undefined, { method: "GET" });
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("allow"), "POST");

  // A JSON-RPC notification must not get a response body.
  const notification = await call({ jsonrpc: "2.0", method: "SendMessage", params: {} });
  assert.equal(notification.status, 204);
});

test("paths outside the interface still reach the page pipeline", async () => {
  const response = await call(undefined, { method: "GET", path: "/unis/msu/", files: {} });
  // 404 from the fake origin, not the 405 the A2A handler answers for GET.
  assert.equal(response.status, 404);
});

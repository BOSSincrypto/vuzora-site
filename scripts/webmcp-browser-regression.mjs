/**
 * Progressive WebMCP browser fixtures for VAL-UX-002.
 *
 * Run against the built static validation surface:
 *   bun run build
 *   bun run test:browser:webmcp
 *
 * The capability-present and capability-absent init scripts run before the
 * application bundle. The absent flow also verifies ordinary route identity
 * and the university CTA, proving WebMCP does not own navigation.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const ORIGIN = process.env.VUZORA_ORIGIN ?? "http://127.0.0.1:3100";
const SESSION = process.env.AGENT_BROWSER_SESSION ?? `vuzora-webmcp-${process.pid}`;
let activeSession = SESSION;
const PRESENT_FIXTURE = join(root, "scripts/fixtures/webmcp-capability-present.js");
const ABSENT_FIXTURE = join(root, "scripts/fixtures/webmcp-capability-absent.js");

function browser(args, { timeout = 30_000 } = {}) {
  const output = execFileSync(
    "agent-browser",
    ["--session", activeSession, "--headed", "false", "--json", ...args],
    { encoding: "utf8", timeout },
  );
  const response = JSON.parse(output);
  if (!response.success) {
    throw new Error(
      `agent-browser ${args.join(" ")} failed: ${response.error ?? output}`,
    );
  }
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
  browser(["wait", "--load", "networkidle"], { timeout: 30_000 });
  browser(["wait", "300"], { timeout: 10_000 });
}

function openWithFixture(fixture) {
  browser(["open", "--init-script", fixture, `${ORIGIN}/`], {
    timeout: 30_000,
  });
  waitForPage();
}

function ordinaryUiSnapshot() {
  return evaluate(`(() => ({
    path: location.pathname,
    anchors: [...document.querySelectorAll("a[href]")].map((anchor) => anchor.href).sort(),
    cta: document.querySelector('[data-cta="bot-navigation"]')?.href ?? null
  }))()`);
}

function assertNoPageErrors() {
  const errors = browser(["errors"]).errors ?? [];
  assert.deepEqual(errors, [], "WebMCP fixture produced page errors");
}

function runCapabilityPresent() {
  openWithFixture(PRESENT_FIXTURE);
  const trace = evaluate(`(() => (window.__vuzoraWebMcpTrace ?? []).map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
    signalAborted: tool.signalAborted
  })))()`);

  assert.deepEqual(
    trace.map(({ name }) => name),
    ["vuzora.search_universities", "vuzora.get_university"],
    "capability-present browser registered an unexpected tool set",
  );
  assert.equal(trace.length, 2);
  for (const tool of trace) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.untrustedContentHint, true);
    assert.equal(tool.inputSchema.type, "object");
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.ok(!/mutat|auth|payment|secret|schedule|live|oauth|api|mcp server/i.test(
      `${tool.description} ${tool.title}`,
    ));
  }
  assert.deepEqual(trace[0].inputSchema.required, ["query"]);
  assert.deepEqual(trace[1].inputSchema.required, ["slug"]);

  const results = evaluate(`(() => {
    const tools = window.__vuzoraWebMcpTrace;
    return {
      search: tools[0].execute({ query: "МГУ" }),
      lookup: tools[1].execute({ slug: "msu" }),
      unknown: tools[1].execute({ slug: "not-a-real-university" })
    };
  })()`);
  assert.equal(results.search[0].slug, "msu");
  assert.equal(results.lookup.slug, "msu");
  assert.equal(results.lookup.detailPath, "/unis/msu");
  assert.equal(results.unknown, null);
  assert.doesNotMatch(JSON.stringify(results), /password|token|secret|schedule table|oauth/i);
  assertNoPageErrors();

  return {
    registeredTools: trace,
    resultKeys: {
      search: results.search.map(({ slug }) => slug),
      lookup: results.lookup.slug,
      unknown: results.unknown,
    },
    ui: ordinaryUiSnapshot(),
  };
}

function runCapabilityAbsent() {
  openWithFixture(ABSENT_FIXTURE);
  const before = ordinaryUiSnapshot();
  assert.equal(evaluate("window.__vuzoraWebMcpTrace.length"), 0);
  assertNoPageErrors();

  browser(["open", `${ORIGIN}/unis/msu`], { timeout: 30_000 });
  waitForPage();
  const detail = evaluate(`(() => ({
    path: location.pathname,
    h1: document.querySelector("h1")?.textContent.trim() ?? null,
    cta: document.querySelector('[data-cta="university-conversion"]')?.href ?? null
  }))()`);
  assert.equal(detail.path, "/unis/msu");
  assert.match(detail.h1, /Московский государственный университет/);
  assert.equal(detail.cta, "https://t.me/vuzora_bot?start=from-site_msu");
  assertNoPageErrors();

  return { ui: before, detail };
}

const report = {
  origin: ORIGIN,
  session: SESSION,
  capabilityPresent: null,
  capabilityAbsent: null,
};

try {
  assert.match(readFileSync(PRESENT_FIXTURE, "utf8"), /registerTool/);
  assert.match(readFileSync(ABSENT_FIXTURE, "utf8"), /modelContext/);
  report.capabilityPresent = runCapabilityPresent();
  browser(["close"], { timeout: 10_000 });
  activeSession = `${SESSION}-absent`;
  report.capabilityAbsent = runCapabilityAbsent();
  assert.deepEqual(
    report.capabilityPresent.ui.anchors,
    report.capabilityAbsent.ui.anchors,
    "WebMCP capability changed ordinary homepage anchors",
  );
  assert.equal(
    report.capabilityPresent.ui.cta,
    report.capabilityAbsent.ui.cta,
    "WebMCP capability changed the ordinary Telegram CTA",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  try {
    browser(["close"], { timeout: 10_000 });
  } catch {
    // Preserve the original assertion or browser failure.
  }
}

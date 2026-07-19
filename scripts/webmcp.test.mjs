import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path) => readFile(join(root, path), "utf8");

test("WebMCP registration is feature-detected and failure-safe", async () => {
  const source = await read("src/lib/webmcp.ts");
  const rootRoute = await read("src/routes/__root.tsx");

  assert.match(source, /target\?\.modelContext/);
  assert.match(source, /typeof modelContext\.registerTool !== "function"/);
  assert.match(source, /registerTool\(tool, options\)/);
  assert.match(source, /\.catch\(\(\) =>/);
  assert.match(source, /AbortController/);
  assert.match(rootRoute, /registerWebMcpTools\(document\)/);
  assert.match(rootRoute, /function WebMcpEnhancement/);
});

test("declared WebMCP tools are stable, read-only, and explicitly shaped", async () => {
  const source = await read("src/lib/webmcp.ts");

  assert.match(source, /vuzora\.search_universities/);
  assert.match(source, /vuzora\.get_university/);
  assert.equal((source.match(/readOnlyHint:\s*true/g) ?? []).length >= 2, true);
  assert.match(source, /type:\s*"object"/);
  assert.match(source, /additionalProperties:\s*false/);
  assert.match(source, /required:\s*\["query"\]/);
  assert.match(source, /required:\s*\["slug"\]/);
  assert.match(source, /UNIVERSITIES\.map/);
  assert.match(source, /findUniversity\(slug\)/);
  assert.doesNotMatch(source, /provideContext|navigator\.modelContext/);
  assert.doesNotMatch(source, /fetch\(|localStorage|sessionStorage/);
});

test("browser fixtures cover both WebMCP capability branches", async () => {
  const present = await read("scripts/fixtures/webmcp-capability-present.js");
  const absent = await read("scripts/fixtures/webmcp-capability-absent.js");
  const browserRunner = await read("scripts/webmcp-browser-regression.mjs");

  assert.match(present, /document,\s*"modelContext"/);
  assert.match(present, /registerTool\(tool, options\)/);
  assert.match(present, /__vuzoraWebMcpTrace/);
  assert.match(absent, /value:\s*undefined/);
  assert.match(absent, /__vuzoraWebMcpTrace/);
  assert.match(browserRunner, /PRESENT_FIXTURE/);
  assert.match(browserRunner, /ABSENT_FIXTURE/);
  assert.match(browserRunner, /vuzora\.search_universities/);
  assert.match(browserRunner, /from-site_msu/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = process.cwd();

function runBun(source, env = {}) {
  const result = spawnSync("npx", ["--yes", "bun@1.3.14", "-e", source], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

test("date-only blog and changelog dates stay on the authored UTC day", () => {
  const output = runBun(
    `
      import { formatPostDate } from "./src/content/blog.ts";
      import { formatEntryDate } from "./src/content/changelog.ts";
      console.log(JSON.stringify([
        formatPostDate("2026-07-03"),
        formatEntryDate("2026-06-28"),
      ]));
    `,
    { TZ: "America/Los_Angeles" },
  );
  assert.deepEqual(JSON.parse(output), ["3 июля 2026 г.", "28 июня 2026 г."]);
});

test("long university descriptions preserve identity and the complete disclaimer", () => {
  const output = runBun(`
    import {
      AFFILIATION_BOUNDARY,
      UNIVERSITIES,
      universityDetailDescription,
    } from "./src/content/universities.ts";

    const selected = UNIVERSITIES.filter((university) =>
      ["hse", "bmstu", "nngu"].includes(university.slug)
    );
    for (const university of selected) {
      const description = universityDetailDescription(university);
      if (
        description.length < 50 ||
        description.length > 170 ||
        !description.includes(university.name) ||
        !description.includes(AFFILIATION_BOUNDARY) ||
        description.endsWith("…")
      ) {
        throw new Error(JSON.stringify({
          slug: university.slug,
          length: description.length,
          description,
        }));
      }
    }
    console.log("OK");
  `);
  assert.equal(output, "OK");
});

test("pricing metadata derives its range from PLANS", async () => {
  const source = await readFile(join(root, "src/routes/pricing.tsx"), "utf8");
  const pricing = await readFile(join(root, "src/content/pricing.ts"), "utf8");
  assert.match(source, /Math\.min\(\.\.\.prices\)/);
  assert.match(source, /Math\.max\(\.\.\.prices\)/);
  assert.match(source, /maxPrice/);
  assert.doesNotMatch(source, /599/);
  assert.match(pricing, /price: 999/);
});

test("WebMCP continues registering safe tools after a synchronous failure", () => {
  const output = runBun(`
    import { registerWebMcpTools } from "./src/lib/webmcp.ts";
    const registered = [];
    registerWebMcpTools({
      modelContext: {
        registerTool(tool) {
          registered.push(tool.name);
          if (registered.length === 1) throw new Error("synchronous test failure");
        },
      },
    });
    registerWebMcpTools({});
    console.log(JSON.stringify(registered));
  `);
  assert.deepEqual(JSON.parse(output), ["vuzora.search_universities", "vuzora.get_university"]);
});

test("concurrent global error captures refuse unsafe attribution", () => {
  const output = runBun(`
    import {
      consumeLastCapturedError,
      startErrorCaptureRequest,
    } from "./src/lib/error-capture.ts";
    const first = startErrorCaptureRequest();
    const second = startErrorCaptureRequest();
    globalThis.dispatchEvent(new ErrorEvent("error", { error: new Error("concurrent") }));
    console.log(String(consumeLastCapturedError()));
    second();
    first();
  `);
  assert.equal(output, "undefined");
});

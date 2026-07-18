import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { artifactFor, readRegistry } from "./route-policy.mjs";

const root = process.cwd();
const read = (path) => readFile(join(root, path), "utf8");

function faqSection(html, route) {
  const match = html.match(
    /<section\b[^>]*data-section=["']faq["'][^>]*>([\s\S]*?)<\/section>/i,
  );
  assert.ok(match, `${route} is missing the FAQ section in initial HTML`);
  return match[1];
}

test("detail FAQ uses native keyboard disclosures with crawlable closed answers", async () => {
  const { universities } = await readRegistry(root);
  const routeSource = await read("src/routes/unis_.$slug.tsx");

  assert.match(routeSource, /<details className="group py-4">/);
  assert.match(routeSource, /data-faq-control/);
  assert.match(routeSource, /tabIndex=\{0\}/);
  assert.match(routeSource, /data-faq-answer/);
  assert.doesNotMatch(routeSource, /onKeyDown|onKeyUp|preventDefault/);

  for (const university of universities) {
    const route = `/unis/${university.slug}`;
    const artifact = artifactFor(route);
    const html = (await read(join("dist", artifact))).replaceAll("\0", "");
    const section = faqSection(html, route);
    const details = [...section.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/gi)];

    assert.equal(details.length, 4, `${route} should expose four FAQ disclosures`);
    for (const [, detailsAttrs, detailsBody] of details) {
      assert.doesNotMatch(detailsAttrs, /\bopen(?:\s*=|>)/i, `${route} FAQ must start closed`);
      const summary = detailsBody.match(/<summary\b([^>]*)>([\s\S]*?)<\/summary>/i);
      assert.ok(summary, `${route} FAQ disclosure is missing its summary`);
      assert.match(summary[1], /\bdata-faq-control(?:\s*=\s*["'][^"']*["'])?\b/i);
      assert.match(summary[1], /\btabindex=["']0["']/i);
      assert.doesNotMatch(summary[1], /\btabindex=["']-1["']/i);
      assert.doesNotMatch(summary[1], /\baria-hidden=/i);
      assert.doesNotMatch(summary[1], /\brole=/i);

      const answer = detailsBody.match(
        /<p\b[^>]*data-faq-answer[^>]*>([\s\S]*?)<\/p>/i,
      );
      assert.ok(answer, `${route} FAQ answer is missing from initial HTML`);
      assert.ok(answer[1].replace(/<[^>]+>/g, "").trim(), `${route} FAQ answer is empty`);
    }
  }
});

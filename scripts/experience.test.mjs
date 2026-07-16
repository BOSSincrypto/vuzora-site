/**
 * Experience contract tests — reduced-motion surfaces, Save-Data, and
 * server-visible content / recovery invariants (VAL-BROWSER-010/011/013).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path) => readFile(join(root, path), "utf8");

test("reduced-motion CSS disables nonessential motion surfaces with none/0ms", async () => {
  const css = await read("src/styles.css");
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /animation-name:\s*none\s*!important/);
  assert.match(css, /transition-duration:\s*0ms\s*!important/);
  // Named surfaces the contract enumerates.
  for (const surface of [
    ".reveal",
    '[data-motion-surface="reveal"]',
    ".morning-loop",
    ".morning-demo",
    '[data-motion-surface="demo"]',
    '[data-motion-surface="menu"]',
    '[data-motion-surface="route"]',
  ]) {
    assert.ok(css.includes(surface), `missing reduced-motion surface ${surface}`);
  }
  // Must not leave the previous sub-millisecond "trick" as the only rule.
  assert.doesNotMatch(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\*,\s*\*::before,\s*\*::after\s*\{\s*animation-duration:\s*0\.001ms/,
  );
});

test("Save-Data path preserves required content and trims optional demo paint", async () => {
  const css = await read("src/styles.css");
  const rootShell = await read("src/routes/__root.tsx");
  const reveal = await read("src/hooks/use-reveal.ts");
  assert.match(css, /html\.save-data/);
  assert.match(rootShell, /save-data/);
  assert.match(rootShell, /navigator\.connection/);
  assert.match(reveal, /saveData/);
  // Optional demo layers may be hidden; required content must not be.
  assert.match(css, /html\.save-data \.morning-loop \.ml-lock/);
  assert.doesNotMatch(css, /html\.save-data main\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /html\.save-data \[data-cta/);
});

test("reveal surfaces stay visible without JS and under reduced motion preferences", async () => {
  const css = await read("src/styles.css");
  const reveal = await read("src/hooks/use-reveal.ts");
  // Default (no html.js) keeps opacity 1 — crawlers / no-JS see content.
  assert.match(css, /\.reveal\s*\{[^}]*opacity:\s*1/s);
  assert.match(css, /html\.js \.reveal/);
  assert.match(reveal, /prefers-reduced-motion/);
  assert.match(reveal, /shouldRevealImmediately/);
});

test("mobile menu is absolutely positioned under the nav pill", async () => {
  const menu = await read("src/components/vuzora/nav/MobileMenu.tsx");
  assert.match(menu, /absolute left-0 right-0 top-full/);
  assert.match(menu, /data-motion-surface="menu"/);
  assert.match(menu, /inert/);
  // Closed state must unmount panel content from tab/hit testing.
  assert.match(menu, /className="[^"]*hidden/);
});

test("not-found recovery UI has known-route recovery without university CTA", async () => {
  const rootNotFound = await read("src/routes/__root.tsx");
  const detail = await read("src/routes/unis_.$slug.tsx");
  const fallbacks = await read("src/components/vuzora/ui/RouteFallbacks.tsx");
  assert.match(rootNotFound, /Такого расписания нет|Такой страницы нет/);
  assert.match(fallbacks, /RouteNotFoundFallback/);
  assert.match(detail, /Такого вуза нет в списке/);
  assert.match(detail, /primaryHref="\/unis"/);
  // Isolate the notFoundComponent block only — the success path still has
  // a university-conversion CTA which must not be part of recovery UI.
  const notFoundBlock = detail.match(
    /notFoundComponent:\s*\(\)\s*=>\s*\(([\s\S]*?)\),\s*\n\s*head:/,
  );
  assert.ok(notFoundBlock, "detail route must declare notFoundComponent");
  assert.doesNotMatch(notFoundBlock[1], /data-cta="university-conversion"/);
  assert.doesNotMatch(notFoundBlock[1], /universityBotUrl/);
  assert.doesNotMatch(fallbacks, /data-cta="university-conversion"/);
  assert.match(fallbacks, /primaryHref\s*=\s*"\/"|to=\{primaryHref\}|to="\/"/);
});

test("route focus manager restores focus after client navigation", async () => {
  const root = await read("src/routes/__root.tsx");
  assert.match(root, /RouteFocusManager/);
  assert.match(root, /useRouterState/);
  assert.match(root, /preventScroll:\s*true/);
  assert.match(root, /sessionStorage|FOCUS_PATH_KEY|vuzora:last-path/);
  assert.match(root, /spaChanged|storageChanged/);
});

test("demo surface is marked for reduced-motion sampling", async () => {
  const morning = await read("src/components/vuzora/MorningLoop.tsx");
  assert.match(morning, /morning-demo/);
  assert.match(morning, /data-motion-surface="demo"/);
});

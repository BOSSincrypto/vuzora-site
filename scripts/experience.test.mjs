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
    '[data-motion-surface="sticky"]',
  ]) {
    assert.ok(css.includes(surface), `missing reduced-motion surface ${surface}`);
  }
  // Sticky intentional hide must keep zeroed motion without opacity:1 !important.
  const stickyRule = css.match(/\[data-motion-surface="sticky"\]\s*\{([^}]+)\}/);
  assert.ok(stickyRule, "sticky motion surface rule missing");
  assert.match(stickyRule[1], /animation-name:\s*none\s*!important/);
  assert.match(stickyRule[1], /transition-duration:\s*0ms\s*!important/);
  assert.doesNotMatch(stickyRule[1], /opacity:\s*1\s*!important/);
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
  const sticky = await read("src/components/vuzora/StickyMobileCta.tsx");
  assert.match(menu, /absolute left-0 right-0 top-full/);
  assert.match(menu, /data-motion-surface="menu"/);
  assert.match(menu, /inert/);
  // Closed state hides from layout/tab/hit testing without removing crawlable CTAs.
  assert.match(menu, /hidden/);
  assert.match(menu, /data-cta="bot-navigation"/);
  assert.match(sticky, /data-cta="generic-conversion"/);
  // Sticky uses a distinct motion surface so reduced-motion cannot force opacity:1.
  assert.match(sticky, /data-motion-surface="sticky"/);
  // Hidden sticky must disable pointer hit-testing on the anchor, not only tabIndex.
  assert.match(sticky, /tabIndex=\{visible \? 0 : -1\}/);
  assert.match(sticky, /pointer-events-none/);
  assert.match(sticky, /visible \? "pointer-events-auto" : "pointer-events-none"/);
  // Must keep CTA anchors in initial HTML (no early-return empty shell only).
  assert.doesNotMatch(
    menu,
    /if\s*\(\s*!open\s*\)\s*\{\s*return\s*\(\s*<div[\s\S]*?\/>\s*\)\s*;?\s*\}/,
  );
  assert.doesNotMatch(
    sticky,
    /if\s*\(\s*!visible\s*\)\s*\{\s*return\s*\(\s*<div[\s\S]*?\/>\s*\)\s*;?\s*\}/,
  );
});

test("opened mobile menu restores pointer input without removing header pass-through", async () => {
  const menu = await read("src/components/vuzora/nav/MobileMenu.tsx");
  const nav = await read("src/components/vuzora/NavBar.tsx");
  // The fixed header stays pass-through outside the nav and opened panel.
  assert.match(nav, /className="nav-drop pointer-events-none/);
  assert.match(nav, /className="pointer-events-auto flex items-center/);
  // Open state must explicitly opt the panel back into hit testing. Closed
  // state remains hidden and pointer-inert while its anchors stay in the DOM.
  assert.match(
    menu,
    /open \? "block pointer-events-auto" : "hidden pointer-events-none"/,
  );
  assert.match(menu, /href=\{l\.href\}/);
  assert.match(menu, /BLOG_INDEX_PATH/);
  assert.match(menu, /href=\{LINKS\.botUrl\}/);
  assert.match(menu, /onClick=\{onClose\}/);
});

/**
 * Pure contract for VAL-BROWSER-007: when viewport crosses into desktop (lg+),
 * the compact menu must close and body scroll-lock must clear. Mirrors
 * `handleDesktopNavMediaChange` in NavBar (kept free of React so node --test
 * can exercise open@mobile → desktop without a DOM renderer).
 */
function handleDesktopNavMediaChange(matchesDesktop, close, clearBodyOverflow) {
  if (!matchesDesktop) return;
  close();
  clearBodyOverflow();
}

test("resize-to-desktop force-closes mobile menu and clears body overflow", () => {
  // Simulate open-at-390 then cross to 1440 (matchMedia min-width 1024).
  let open = true;
  let bodyOverflow = "hidden";
  const close = () => {
    open = false;
  };
  const clearBodyOverflow = () => {
    bodyOverflow = "";
  };

  // Still mobile: no-op — open state and scroll-lock must remain.
  handleDesktopNavMediaChange(false, close, clearBodyOverflow);
  assert.equal(open, true);
  assert.equal(bodyOverflow, "hidden");

  // Desktop media matches: close + clear overflow (VAL-BROWSER-007).
  handleDesktopNavMediaChange(true, close, clearBodyOverflow);
  assert.equal(open, false);
  assert.equal(bodyOverflow, "");
  // Closed body overflow must not remain 'hidden'.
  assert.notEqual(bodyOverflow, "hidden");
});

test("NavBar wires matchMedia lg+ to force-close mobile menu", async () => {
  const nav = await read("src/components/vuzora/NavBar.tsx");
  const menu = await read("src/components/vuzora/nav/MobileMenu.tsx");
  // Desktop breakpoint matches Tailwind lg (hamburger is lg:hidden).
  assert.match(nav, /DESKTOP_NAV_MQ\s*=\s*"\(min-width:\s*1024px\)"/);
  assert.match(nav, /matchMedia\(DESKTOP_NAV_MQ\)/);
  assert.match(nav, /addEventListener\("change"/);
  // Dual path: matchMedia change + window resize (automation/CDP may only surface one).
  assert.match(nav, /window\.addEventListener\("resize"/);
  assert.match(nav, /handleDesktopNavMediaChange/);
  // Closing must clear body overflow lock left from open mobile state.
  assert.match(nav, /document\.body\.style\.overflow\s*=\s*""/);
  // Closed MobileMenu still keeps crawlable data-cta anchors in the tree.
  assert.match(menu, /data-cta="bot-navigation"/);
  assert.match(menu, /open \? "block pointer-events-auto" : "hidden pointer-events-none"/);
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
  // Multi-timeout retries must clear on cleanup and avoid fighting the menu trap.
  assert.match(root, /clearTimeout/);
  assert.match(root, /timeoutIds/);
  assert.match(root, /isMobileMenuFocusTrapActive|aria-expanded.*true|vuzora-mobile-menu/);
});

test("demo surface is marked for reduced-motion sampling", async () => {
  const morning = await read("src/components/vuzora/MorningLoop.tsx");
  assert.match(morning, /morning-demo/);
  assert.match(morning, /data-motion-surface="demo"/);
});

/**
 * Exhaustive browser coverage for VAL-UX-001.
 *
 * Run against the built static validation surface:
 *   bun run build
 *   bun run test:browser:mobile-menu
 *
 * The browser session is always explicit and external Telegram links are
 * verified by their activated href without making availability of Telegram a
 * requirement for the local navigation regression.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const ORIGIN = process.env.VUZORA_ORIGIN ?? "http://127.0.0.1:3100";
const SESSION =
  process.env.AGENT_BROWSER_SESSION ?? `vuzora-mobile-menu-${process.pid}`;
const MOBILE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 320, height: 800 },
];
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_MENU = "#vuzora-mobile-menu";
const MENU_BUTTON = 'button[aria-label="Открыть меню"]';
const CLOSE_BUTTON = 'button[aria-label="Закрыть меню"]';

function browser(args, { timeout = 30_000 } = {}) {
  const output = execFileSync(
    "agent-browser",
    ["--session", SESSION, "--json", ...args],
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

function waitFor(expression) {
  browser(["wait", "--fn", expression], { timeout: 30_000 });
}

function waitForPage() {
  browser(["wait", "--load", "networkidle"], { timeout: 30_000 });
  browser(["wait", "500"], { timeout: 10_000 });
}

function normalizeDestination(rawHref) {
  const url = new URL(rawHref, `${ORIGIN}/`);
  const pathname =
    url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");
  return `${url.origin}${pathname}${url.search}${url.hash}`;
}

function visibleAnchorData(selector) {
  return evaluate(`(() => {
    const isVisible = (anchor) => {
      const rect = anchor.getBoundingClientRect();
      const style = getComputedStyle(anchor);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.pointerEvents !== "none";
    };
    return [...document.querySelectorAll(${JSON.stringify(selector)})]
      .filter(isVisible)
      .map((anchor) => ({
        href: anchor.getAttribute("href"),
        text: anchor.textContent.trim(),
      }));
  })()`);
}

function crawlableHrefSet() {
  return evaluate(`(() => [...new Set(
    [...document.querySelectorAll("a[href]")]
      .map((anchor) => new URL(anchor.getAttribute("href"), location.href).href)
  )].sort())()`);
}

function openHome(width, height) {
  browser(["open", `${ORIGIN}/`], { timeout: 30_000 });
  browser(["set", "viewport", String(width), String(height)]);
  waitForPage();
}

function openMenu() {
  evaluate(`document.querySelector(${JSON.stringify(MENU_BUTTON)})?.click()`);
  waitFor(
    `document.querySelector(${JSON.stringify(MOBILE_MENU)})?.className.includes("block")`,
  );
}

function closeMenu() {
  evaluate(`document.querySelector(${JSON.stringify(CLOSE_BUTTON)})?.click()`);
  waitFor(
    `document.querySelector(${JSON.stringify(MOBILE_MENU)})?.className.includes("hidden")`,
  );
}

function activateVisibleAnchor(selector, index, pointerType) {
  return evaluate(`(() => {
    const isVisible = (anchor) => {
      const rect = anchor.getBoundingClientRect();
      const style = getComputedStyle(anchor);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.pointerEvents !== "none";
    };
    const anchor = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .filter(isVisible)[${index}];
    if (!anchor) throw new Error("visible anchor missing at index ${index}");

    const external = new URL(anchor.href).origin !== location.origin;
    if (external) {
      anchor.addEventListener("click", (event) => event.preventDefault(), {
        capture: true,
        once: true,
      });
    }
    anchor.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerType: ${JSON.stringify(pointerType)},
      isPrimary: true,
    }));
    anchor.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      pointerType: ${JSON.stringify(pointerType)},
      isPrimary: true,
    }));
    const clickDispatched = anchor.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    }));
    return {
      href: anchor.getAttribute("href"),
      activated: true,
      clickDispatched,
      external,
    };
  })()`);
}

function assertHrefSetsEqual(before, after, label) {
  assert.deepEqual(
    after,
    before,
    `${label}: crawlable anchor href set changed after closing the menu`,
  );
}

function activateAndVerify({
  selector,
  anchor,
  index,
  pointerType,
  viewport,
  report,
}) {
  const expected = normalizeDestination(anchor.href);
  const activation = activateVisibleAnchor(selector, index, pointerType);
  assert.equal(
    activation.href,
    anchor.href,
    `${viewport}: anchor ${index} href changed before activation`,
  );
  assert.equal(
    activation.activated,
    true,
    `${viewport}: anchor ${index} did not receive an activation event`,
  );

  if (!activation.external) {
    browser(["wait", "2000"], { timeout: 10_000 });
    const reached = normalizeDestination(browser(["get", "url"]).url);
    assert.equal(
      reached,
      expected,
      `${viewport}: ${anchor.text} did not reach ${expected}`,
    );
    report.push({
      text: anchor.text,
      href: anchor.href,
      expected,
      reached,
      activation: pointerType,
    });
    return;
  }

  // External availability is intentionally out of scope. The click event was
  // delivered to the ordinary anchor and its exact href is the destination.
  report.push({
    text: anchor.text,
    href: anchor.href,
    expected,
    reached: expected,
    activation: pointerType,
    external: true,
  });
}

function runMobileViewport(viewport) {
  openHome(viewport.width, viewport.height);
  const before = crawlableHrefSet();
  openMenu();
  const anchors = visibleAnchorData(`${MOBILE_MENU} a[href]`);
  assert.ok(anchors.length > 0, `${viewport.width}: opened mobile menu is empty`);

  const traces = [];
  for (const [index, anchor] of anchors.entries()) {
    openHome(viewport.width, viewport.height);
    openMenu();
    activateAndVerify({
      selector: `${MOBILE_MENU} a[href]`,
      anchor,
      index,
      pointerType: "touch",
      viewport: `${viewport.width}x${viewport.height}`,
      report: traces,
    });
  }

  openHome(viewport.width, viewport.height);
  openMenu();
  closeMenu();
  const after = crawlableHrefSet();
  assertHrefSetsEqual(
    before,
    after,
    `${viewport.width}x${viewport.height}`,
  );
  return {
    viewport: `${viewport.width}x${viewport.height}`,
    inventory: anchors,
    traces,
    crawlableHrefCount: before.length,
    hrefSetsEqual: true,
  };
}

function runDesktopViewport() {
  openHome(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height);
  const anchors = visibleAnchorData('nav[aria-label="Главная навигация"] a[href]');
  assert.ok(anchors.length > 0, "desktop navigation inventory is empty");
  const traces = [];

  for (const [index, anchor] of anchors.entries()) {
    openHome(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height);
    activateAndVerify({
      selector: 'nav[aria-label="Главная навигация"] a[href]',
      anchor,
      index,
      pointerType: "mouse",
      viewport: "1440x900",
      report: traces,
    });
  }

  return {
    viewport: "1440x900",
    inventory: anchors,
    traces,
  };
}

const report = {
  origin: ORIGIN,
  session: SESSION,
  mobile: [],
  desktop: null,
};

try {
  for (const viewport of MOBILE_VIEWPORTS) {
    report.mobile.push(runMobileViewport(viewport));
  }
  report.desktop = runDesktopViewport();
  console.log(JSON.stringify(report, null, 2));
} finally {
  try {
    browser(["close"], { timeout: 10_000 });
  } catch {
    // Preserve the original assertion or browser failure.
  }
}

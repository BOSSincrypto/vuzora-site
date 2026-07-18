/**
 * Exhaustive browser coverage for VAL-UX-001.
 *
 * Run against the built static validation surface:
 *   bun run build
 *   bun run test:browser:mobile-menu
 *
 * The browser session is always explicit. Every control and anchor is
 * activated through rendered mouse coordinates, so CSS hit-testing and
 * pointer-events are part of the assertion. External Telegram links are
 * checked for target=_blank and observed browser-tab behavior without making
 * Telegram availability a requirement for the local navigation regression.
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
const MENU_TOGGLE = 'button[aria-controls="vuzora-mobile-menu"]';

function browser(args, { timeout = 30_000 } = {}) {
  const output = execFileSync(
    "agent-browser",
    ["--session", SESSION, "--headed", "false", "--json", ...args],
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

function tabList() {
  return browser(["tab", "list"]).tabs;
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
    const selectorPath = (element) => {
      const segments = [];
      let current = element;
      while (current && current !== document.body) {
        let segment = current.tagName.toLowerCase();
        if (current.id) {
          segments.unshift("#" + CSS.escape(current.id));
          break;
        }
        const siblings = [...(current.parentElement?.children ?? [])].filter(
          (sibling) => sibling.tagName === current.tagName,
        );
        segment += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
        segments.unshift(segment);
        current = current.parentElement;
      }
      return segments.join(" > ");
    };
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
        target: anchor.getAttribute("target"),
        selector: selectorPath(anchor),
        rect: (() => {
          const { x, y, width, height } = anchor.getBoundingClientRect();
          return { x, y, width, height };
        })(),
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

function renderedTarget(selector, index = 0) {
  return evaluate(`(() => {
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.pointerEvents !== "none";
    };
    const element = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .filter(isVisible)[${index}];
    if (!element) throw new Error(
      \`visible target missing for \${${JSON.stringify(selector)}} at index ${index}\`,
    );
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  })()`);
}

function clickRenderedTarget(selector, index = 0) {
  const target = renderedTarget(selector, index);
  const x = Math.round(target.x + target.width / 2);
  const y = Math.round(target.y + target.height / 2);
  browser(["mouse", "move", String(x), String(y)]);
  browser(["mouse", "down"]);
  browser(["mouse", "up"]);
  return { ...target, x, y, input: "rendered-coordinate-mouse" };
}

function openMenu() {
  const input = clickRenderedTarget(MENU_TOGGLE);
  browser(["wait", "100"], { timeout: 10_000 });
  assert.equal(
    evaluate(
      `document.querySelector(${JSON.stringify(MENU_TOGGLE)})?.getAttribute("aria-expanded") === "true"`,
    ),
    true,
    "rendered menu control did not open the mobile menu",
  );
  return input;
}

function closeMenu() {
  const input = clickRenderedTarget(MENU_TOGGLE);
  browser(["wait", "100"], { timeout: 10_000 });
  assert.equal(
    evaluate(
      `document.querySelector(${JSON.stringify(MENU_TOGGLE)})?.getAttribute("aria-expanded") === "false"`,
    ),
    true,
    "rendered menu control did not close the mobile menu",
  );
  return input;
}

function activateVisibleAnchor(anchor) {
  const input = clickRenderedTarget(anchor.selector);
  return {
    ...input,
    href: anchor.href,
    external: new URL(anchor.href, `${ORIGIN}/`).origin !== new URL(ORIGIN).origin,
    target: anchor.target,
  };
}

function assertHrefSetsEqual(before, after, label) {
  assert.deepEqual(
    after,
    before,
    `${label}: crawlable anchor href set changed after closing the menu`,
  );
}

function activateAndVerify({
  anchor,
  viewport,
  report,
}) {
  const expected = normalizeDestination(anchor.href);
  const beforeTabs = tabList();
  const activation = activateVisibleAnchor(anchor);
  browser(["wait", "1000"], { timeout: 10_000 });
  const afterTabs = tabList();
  const newTabs = afterTabs.filter(
    (tab) => !beforeTabs.some((beforeTab) => beforeTab.tabId === tab.tabId),
  );

  if (!activation.external) {
    waitForPage();
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
      activation: activation.input,
    });
    return;
  }

  assert.equal(
    anchor.target,
    "_blank",
    `${viewport}: external anchor ${anchor.text} must retain target=_blank`,
  );
  assert.ok(
    newTabs.length > 0 || activation.target === "_blank",
    `${viewport}: external anchor ${anchor.text} did not expose target=_blank or open a new tab`,
  );
  report.push({
    text: anchor.text,
    href: anchor.href,
    expected,
    reached: newTabs[0]?.url ?? null,
    activation: activation.input,
    target: anchor.target,
    openedNewTab: newTabs.length > 0,
    browserTabs: afterTabs.map(({ tabId, url }) => ({ tabId, url })),
    external: true,
  });

  // Keep each subsequent activation isolated to the original page tab. When
  // a browser opens target=_blank, close only the newly-created tab and
  // restore the tab that contained the rendered menu.
  for (const tab of newTabs) {
    browser(["tab", "close", tab.tabId]);
  }
  const originalTab = beforeTabs.find((tab) => tab.active);
  if (originalTab) browser(["tab", originalTab.tabId]);
}

function runMobileViewport(viewport) {
  openHome(viewport.width, viewport.height);
  const before = crawlableHrefSet();
  const openInput = openMenu();
  const anchors = visibleAnchorData(`${MOBILE_MENU} a[href]`);
  assert.ok(anchors.length > 0, `${viewport.width}: opened mobile menu is empty`);

  const traces = [];
  for (const anchor of anchors) {
    openHome(viewport.width, viewport.height);
    openMenu();
    activateAndVerify({
      anchor,
      viewport: `${viewport.width}x${viewport.height}`,
      report: traces,
    });
  }

  openHome(viewport.width, viewport.height);
  openMenu();
  const closeInput = closeMenu();
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
    openInput,
    closeInput,
    crawlableHrefCount: before.length,
    hrefSetsEqual: true,
  };
}

function runDesktopViewport() {
  openHome(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height);
  const anchors = visibleAnchorData('nav[aria-label="Главная навигация"] a[href]');
  assert.ok(anchors.length > 0, "desktop navigation inventory is empty");
  const traces = [];

  for (const anchor of anchors) {
    openHome(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height);
    activateAndVerify({
      anchor,
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

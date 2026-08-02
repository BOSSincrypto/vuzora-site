import {
  Outlet,
  createRootRoute,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import appCss from "../styles.css?url";
import interCyrillicWoff2 from "@fontsource-variable/inter/files/inter-cyrillic-wght-normal.woff2?url";
import interLatinWoff2 from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import { registerWebMcpTools } from "../lib/webmcp";
import {
  RouteErrorFallback,
  RouteNotFoundFallback,
} from "@/components/vuzora/ui/RouteFallbacks";
import { SITE_URL, BRAND } from "@/content/vuzora";

// Hoisted to module scope so JSON.stringify runs once at module init,
// not on every SSR head() call.
const ROOT_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      url: `${SITE_URL}/`,
      name: BRAND.name,
      legalName: BRAND.legal.entity,
      email: BRAND.email,
      taxID: BRAND.legal.inn,
      address: { "@type": "PostalAddress", addressLocality: "Москва", addressCountry: "RU" },
      sameAs: ["https://t.me/vuzora_bot"],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#site`,
      url: `${SITE_URL}/`,
      name: BRAND.name,
      inLanguage: "ru-RU",
      publisher: { "@id": `${SITE_URL}/#org` },
    },
  ],
});

const ROOT_SCRIPTS = [{ type: "application/ld+json", children: ROOT_JSON_LD }];

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // og:type / og:locale / og:url are set per-route so social scrapers
      // don't see duplicate tags. og:site_name is stable across the site.
      { property: "og:site_name", content: "Vuzora" },
      { name: "theme-color", content: "#14112B" },
      { name: "format-detection", content: "telephone=no" },
    ],

    links: [
      { rel: "stylesheet", href: appCss },
      // Preload the two Inter subsets used above the fold (Cyrillic body copy
      // + Latin numerals/units) — eliminates FOUT on LCP text.
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: interCyrillicWoff2,
        crossOrigin: "anonymous",
      } as unknown as Record<string, string>,
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: interLatinWoff2,
        crossOrigin: "anonymous",
      } as unknown as Record<string, string>,
      // A real /favicon.ico is what Google's favicon crawler picks up
      // reliably; an SVG-only icon often leaves search results with no
      // favicon at all. The manifest carries the 192/512 PNGs that Chrome
      // wants before it offers to install the app. All three are built from
      // public/favicon.svg by scripts/generate-icons.mjs.
      //
      // Still no apple-touch-icon: the artwork is a rounded plate on
      // transparency, and iOS composites that over black and applies its own
      // mask — it needs a square, opaque icon that does not exist here yet.
      { rel: "icon", type: "image/x-icon", sizes: "16x16 32x32 48x48", href: "/favicon.ico" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
    scripts: ROOT_SCRIPTS,
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <RouteNotFoundFallback
      title="Такого расписания нет"
      description="Страница не нашлась. Это не страшно – расписание подождёт. Вернись на главную, там всё на месте."
    />
  ),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback error={error} reset={reset} label="root" />
  ),
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className="dark" suppressHydrationWarning>
      <head>
        {/* Toggle `html.js` before the first paint so reveal-on-scroll CSS
         * only hides content when JS is actually running. Prevents blank
         * sections for crawlers, no-JS users, and briefly broken bundles.
         * Also mirror Save-Data onto `html.save-data` for reduced-data CSS. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.classList.add('js');try{if(navigator.connection&&navigator.connection.saveData){document.documentElement.classList.add('save-data');}}catch(e){}/* Fail-safe: if the client bundle never mounts (RevealBundleMarker stamps data-reveal-js), force-show server content so crawlers with partial JS and broken bundles never keep sections at opacity 0. Healthy sessions keep the IntersectionObserver-driven reveal. */(function(){function revealAll(){try{document.querySelectorAll('.reveal:not([data-revealed=\"true\"]),.reveal-stagger:not([data-revealed=\"true\"])').forEach(function(el){el.dataset.revealed='true';});}catch(e){}}if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){revealAll();return;}window.setTimeout(function(){if(document.documentElement.dataset.revealJs){return;}revealAll();},1800);})();",
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * After same-origin navigations, land keyboard focus on main/H1 (or the first
 * actionable control inside main) so focus is never detached or left on a
 * stale node behind an overlay (VAL-BROWSER-014).
 *
 * Handles both SPA path changes (`useRouterState`) and full document loads
 * that arrive from another on-site URL (referrer / performance navigation).
 * Cold first visits are left alone so the skip-link remains the first stop.
 *
 * Skips focus moves while the mobile menu focus trap is active so retries do
 * not steal focus from the open panel. All multi-timeout retries are cleared
 * on effect cleanup (path change / unmount).
 */
function isMobileMenuFocusTrapActive() {
  if (typeof document === "undefined") return false;
  const toggle = document.querySelector<HTMLElement>('[aria-controls="vuzora-mobile-menu"]');
  return toggle?.getAttribute("aria-expanded") === "true";
}

function focusRouteSurface() {
  if (typeof document === "undefined") return;
  // Do not fight the open mobile menu focus trap.
  if (isMobileMenuFocusTrapActive()) return;
  const main = document.querySelector("main");
  if (!main) return;
  // Prefer visible H1 text (skip sr-only if a visible heading exists later).
  const headings = [...main.querySelectorAll<HTMLElement>("h1, h2")];
  const heading =
    headings.find((el) => {
      if (el.classList.contains("sr-only")) return false;
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    });
  const target =
    heading ??
    main.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ??
    (main as HTMLElement);

  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
  }

  try {
    target.focus({ preventScroll: true });
  } catch {
    /* ignore focus failures in non-interactive environments */
  }
}

const FOCUS_PATH_KEY = "vuzora:last-path";

function RouteFocusManager() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const timeoutIds: number[] = [];

    // Retry a few times so a late paint or hydration doesn't leave focus on body.
    // Clear all scheduled retries on cleanup so path changes / unmount cannot
    // leave stale timers fighting a later focus trap or a newer route.
    const scheduleFocus = () => {
      for (const ms of [0, 50, 150, 300]) {
        timeoutIds.push(window.setTimeout(focusRouteSurface, ms));
      }
    };

    const spaChanged = previousPath.current !== null && previousPath.current !== pathname;

    // sessionStorage survives full reloads (agent-browser hard navigations).
    // Compare *before* writing so a cold first visit (no key yet) stays quiet
    // and Strict Mode remounts with the same path do not re-trigger focus.
    let storageChanged = false;
    try {
      const last = sessionStorage.getItem(FOCUS_PATH_KEY);
      storageChanged = last !== null && last !== pathname;
      sessionStorage.setItem(FOCUS_PATH_KEY, pathname);
    } catch {
      storageChanged = false;
    }

    previousPath.current = pathname;

    if (spaChanged || storageChanged) {
      scheduleFocus();
    }

    return () => {
      for (const id of timeoutIds) {
        window.clearTimeout(id);
      }
    };
  }, [pathname]);

  return null;
}

function WebMcpEnhancement() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    return registerWebMcpTools(document);
  }, []);

  return null;
}

/**
 * Stamp `data-reveal-js` once the client bundle mounts so the inline
 * fail-safe in RootShell's head script only force-reveals sections when the
 * bundle really failed — not on every healthy load 1.8s in.
 */
function RevealBundleMarker() {
  useEffect(() => {
    document.documentElement.dataset.revealJs = "true";
  }, []);

  return null;
}

function RootComponent() {
  return (
    <>
      <WebMcpEnhancement />
      <RouteFocusManager />
      <RevealBundleMarker />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </>
  );
}

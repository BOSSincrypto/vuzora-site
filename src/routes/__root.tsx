import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import appCss from "../styles.css?url";
import interCyrillicWoff2 from "@fontsource-variable/inter/files/inter-cyrillic-wght-normal.woff2?url";
import interLatinWoff2 from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
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

function NotFoundComponent() {
  return (
    <div className="grain flex min-h-screen items-center justify-center bg-ink px-6 text-white">
      <div className="max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber/80">
          404 · Тишина
        </p>
        <h1
          className="mt-4 font-display text-white"
          style={{
            fontSize: "clamp(2.5rem, 7vw, 4rem)",
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: "-0.04em",
          }}
        >
          Такого расписания нет
        </h1>
        <p className="mt-5 text-base leading-relaxed text-white/65">
          Страница не нашлась. Это не страшно – расписание подождёт. Вернись на главную, там всё на
          месте.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-amber/90"
          >
            На главную
          </Link>
          <Link
            to="/blog"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/5"
          >
            В блог
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    try {
      console.error("[vuzora:root]", error);
      reportLovableError(error, { boundary: "tanstack_root_error_component" });
    } catch {
      /* never let reporting crash the error screen */
    }
  }, [error]);

  return (
    <div className="grain flex min-h-screen items-center justify-center bg-ink px-6 text-white">
      <div className="max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber/80">
          Сбой · но не в расписании
        </p>
        <h1
          className="mt-4 font-display text-white"
          style={{
            fontSize: "clamp(2rem, 5vw, 2.75rem)",
            lineHeight: 1.1,
            fontWeight: 800,
            letterSpacing: "-0.035em",
          }}
        >
          Страница не загрузилась
        </h1>
        <p className="mt-5 text-base leading-relaxed text-white/65">
          Что-то пошло не так на нашей стороне. Попробуй ещё раз или вернись на главную – расписание
          подождёт.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              try {
                router.invalidate();
              } finally {
                reset();
              }
            }}
            className="inline-flex items-center justify-center rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-amber/90"
          >
            Попробовать снова
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/5"
          >
            На главную
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
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
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/favicon.svg" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
    scripts: ROOT_SCRIPTS,
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
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
              "document.documentElement.classList.add('js');try{if(navigator.connection&&navigator.connection.saveData){document.documentElement.classList.add('save-data');}}catch(e){}/* Fail-safe: if the client bundle never mounts useReveal, force-show server content so crawlers with partial JS and broken bundles never keep sections at opacity 0. */(function(){function revealAll(){try{document.querySelectorAll('.reveal:not([data-revealed=\"true\"]),.reveal-stagger:not([data-revealed=\"true\"])').forEach(function(el){el.dataset.revealed='true';});}catch(e){}}if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){revealAll();return;}window.setTimeout(revealAll,1800);})();",
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
 */
function focusRouteSurface() {
  if (typeof document === "undefined") return;
  const main = document.querySelector("main");
  if (!main) return;
  // Prefer visible H1 text (skip sr-only if a visible heading exists later).
  const headings = [...main.querySelectorAll<HTMLElement>("h1, h2")];
  const heading =
    headings.find((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    }) ?? headings[0];
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

    // Retry a few times so a late paint or hydration doesn't leave focus on body.
    const scheduleFocus = () => {
      for (const ms of [0, 50, 150, 300]) {
        window.setTimeout(focusRouteSurface, ms);
      }
    };

    const spaChanged =
      previousPath.current !== null && previousPath.current !== pathname;

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
  }, [pathname]);

  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <RouteFocusManager />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}

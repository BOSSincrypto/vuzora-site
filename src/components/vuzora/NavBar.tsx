/**
 * Top navigation bar.
 *
 * Responsive shell:
 *  - Desktop (`lg+`): inline link list + pill "Открыть в Telegram" CTA.
 *  - Mobile (`< lg`): logo + Telegram icon + hamburger toggling
 *    {@link MobileMenu}.
 *
 * Owns the a11y wiring for the mobile menu (scroll-lock, focus trap,
 * Escape-to-close, focus return). Presentation lives in `./nav/*`.
 *
 * @module components/vuzora/NavBar
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Logo, Wordmark } from "./Logo";
import { MobileMenu } from "./nav/MobileMenu";
import { TelegramIconLink } from "./nav/TelegramIconLink";
import { LINKS, NAV_LINKS } from "@/content/vuzora";

const MOBILE_MENU_ID = "vuzora-mobile-menu";

/**
 * Tailwind `lg` breakpoint media query. The hamburger + MobileMenu panel are
 * `lg:hidden`; once the viewport matches this query the compact menu must
 * force-close so we never leave aria-expanded=true + body scroll-lock after a
 * mobile→desktop resize (VAL-BROWSER-007).
 */
export const DESKTOP_NAV_MQ = "(min-width: 1024px)";

/**
 * Pure desktop-media handler used by {@link NavBar} and unit-tested for the
 * resize-to-desktop close path. When the query matches, close and clear any
 * body overflow lock left from the mobile open state.
 */
export function handleDesktopNavMediaChange(
  matchesDesktop: boolean,
  close: () => void,
  clearBodyOverflow: () => void = () => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }
  },
): void {
  if (!matchesDesktop) return;
  close();
  clearBodyOverflow();
}

/** Render the site-wide navigation bar (fixed at the top of the viewport). */
export function NavBar() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setOpen(false), []);
  const toggleMenu = useCallback(() => setOpen((v) => !v), []);

  /**
   * Give the clicked link a quick pop and flash the target section so users
   * see *where* they landed after the smooth-scroll (native browser scroll,
   * driven by the anchor + `html { scroll-behavior: smooth }`).
   */
  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      const el = e.currentTarget;
      el.classList.remove("click-pop");
      // Reflow so the animation restarts even on rapid re-clicks.
      void el.offsetWidth;
      el.classList.add("click-pop");

      const href = el.getAttribute("href") ?? "";
      if (href.startsWith("#") || href.startsWith("/#")) {
        const id = href.replace(/^\/?#/, "");
        const target = document.getElementById(id);
        // Target present → we're on the home route: take over the scroll so
        // it's smooth AND we can flash the destination once it's in view.
        // Target absent → we're on another route; let the browser navigate
        // to "/#id" and handle the native hash-scroll itself.
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          // Keep the URL hash in sync without adding a history entry storm.
          if (typeof history !== "undefined") {
            history.replaceState(null, "", `#${id}`);
          }
          target.classList.remove("section-flash");
          void target.offsetWidth;
          target.classList.add("section-flash");
          window.setTimeout(() => target.classList.remove("section-flash"), 1300);
        }
      }
      closeMenu();
    },
    [closeMenu],
  );

  // Force-close the compact menu when the viewport crosses into desktop (lg+).
  // Without this, an open mobile menu resized to 1440px keeps aria-expanded=true
  // and body overflow=hidden even though the panel is CSS-hidden via lg:hidden.
  // Listen to both matchMedia("change") and window resize: some automation
  // drivers only surface one path when the viewport is resized programmatically.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia(DESKTOP_NAV_MQ);
    const onChange = () => {
      handleDesktopNavMediaChange(mql.matches, closeMenu);
    };
    onChange();
    mql.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, [closeMenu]);

  // Lock scroll while open + Escape closes + return focus to toggle + focus trap.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    if (!open) return;

    // Move focus into the panel so keyboard/screen-reader users don't get
    // stuck cycling the page behind the overlay.
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    // Click outside the panel + toggle dismisses the menu. Use mousedown so
    // we win the race against link `onClick` handlers on the panel itself.
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (toggleRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
      document.body.style.overflow = "";
    };
  }, [open]);


  return (
    <header
      data-motion-surface="route"
      className="nav-drop pointer-events-none fixed left-1/2 top-3 z-50 w-[calc(100%-1rem)] max-w-6xl -translate-x-1/2 md:top-4 md:w-[calc(100%-1.5rem)]"
      style={{ zIndex: "var(--z-nav)" as unknown as number }}
    >
      <nav
        className="pointer-events-auto flex items-center justify-between gap-2 rounded-full border border-white/10 bg-ink/75 py-2 pl-3 pr-2 backdrop-blur-xl md:gap-3 md:pl-4"
        aria-label="Главная навигация"
      >
        <a
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-full md:gap-2.5"
          onClick={closeMenu}
        >
          <Logo size={24} />
          <Wordmark />
        </a>

        <div className="hidden items-center gap-0.5 lg:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={handleNavClick}
              className="nav-item whitespace-nowrap rounded-full px-2 py-2 text-[13px] text-white/65 transition-colors hover:text-white focus-visible:text-white"
            >
              {l.label}
            </a>
          ))}
          <a
            href="/blog"
            onClick={handleNavClick}
            className="nav-item whitespace-nowrap rounded-full px-2 py-2 text-[13px] text-white/65 transition-colors hover:text-white focus-visible:text-white"
          >
            Блог
          </a>
        </div>



        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={LINKS.botUrl}
            data-cta="bot-navigation"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden shrink-0 whitespace-nowrap rounded-full bg-white px-3.5 py-2 text-[13px] font-medium text-ink transition-transform duration-200 ease-out hover:bg-mist active:scale-[0.97] sm:inline-flex"
          >
            Открыть в Telegram
          </a>


          <TelegramIconLink className="sm:hidden" />

          <button
            ref={toggleRef}
            type="button"
            onClick={toggleMenu}
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
            aria-controls={MOBILE_MENU_ID}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-white/80 transition-colors hover:text-white lg:hidden"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {open ? (
                <>
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </>
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      <MobileMenu id={MOBILE_MENU_ID} open={open} onClose={closeMenu} ref={panelRef} />
    </header>
  );
}

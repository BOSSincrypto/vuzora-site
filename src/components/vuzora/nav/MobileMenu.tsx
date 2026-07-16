/**
 * Mobile dropdown menu rendered under the navbar pill on `< lg` viewports.
 *
 * Pure presentation: receives `open` state, `id` for `aria-controls`, an
 * `onClose` callback, and a ref for the focus trap from the parent navbar.
 * All a11y wiring (scroll lock, focus trap, Escape handler) lives in
 * {@link NavBar} so this stays a simple component.
 *
 * @module components/vuzora/nav/MobileMenu
 */

import { forwardRef } from "react";
import { LINKS, NAV_LINKS } from "@/content/vuzora";

type Props = {
  id: string;
  open: boolean;
  onClose: () => void;
};

/** Animated dropdown panel containing every nav link + a full-width CTA. */
export const MobileMenu = forwardRef<HTMLDivElement, Props>(function MobileMenu(
  { id, open, onClose },
  ref,
) {
  return (
    <div
      id={id}
      ref={ref}
      className={`lg:hidden ${
        open
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-2 opacity-0"
      } mt-2 transition-all duration-200 ease-out`}
      aria-hidden={!open}
      // `inert` removes the subtree from tab order, hit testing, and the
      // a11y tree in one property — prevents keyboard users from landing
      // on invisible links behind the closed panel.
      {...(!open ? { inert: "" as unknown as boolean } : {})}
    >
      <div className="rounded-3xl border border-white/10 bg-ink/95 p-2 backdrop-blur-xl">
        <ul className="flex flex-col">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={onClose}
                className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-[15px] text-white/85 transition-colors hover:bg-white/5 hover:text-white"
              >
                <span>{l.label}</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white/30"
                  aria-hidden
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </a>
            </li>
          ))}
          <li>
            <a
              href="/blog"
              onClick={onClose}
              className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-[15px] text-white/85 transition-colors hover:bg-white/5 hover:text-white"
            >
              <span>Блог</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </a>
          </li>
        </ul>
        <a
          href={LINKS.botUrl}
          data-cta="bot-navigation"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-medium text-ink transition-transform active:scale-[0.98]"
        >
          Открыть в Telegram
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
});

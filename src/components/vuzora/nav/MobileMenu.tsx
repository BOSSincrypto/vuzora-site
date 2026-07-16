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
  // Use display + visibility (not opacity) for open state. Opacity utilities
  // were stacking with sticky/nav motion surfaces and left the open panel at
  // computed opacity 0 even when class `opacity-100` was present.
  if (!open) {
    return (
      <div
        id={id}
        ref={ref}
        data-motion-surface="menu"
        className="absolute left-0 right-0 top-full z-50 mt-2 hidden lg:hidden"
        aria-hidden="true"
        inert={"" as unknown as boolean}
      />
    );
  }

  return (
    <div
      id={id}
      ref={ref}
      data-motion-surface="menu"
      // Absolute under the nav pill so a closed panel never inflates header
      // height (which previously stuck `.nav-drop` above the viewport).
      className="absolute left-0 right-0 top-full z-50 mt-2 block lg:hidden"
      aria-hidden={false}
    >
      <div className="rounded-3xl border border-white/10 bg-ink/95 p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.65)] backdrop-blur-xl">
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

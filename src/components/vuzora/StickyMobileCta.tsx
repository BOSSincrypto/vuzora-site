/**
 * Floating "Открыть в Telegram" bar fixed to the bottom of the viewport on
 * mobile. Appears after the user has scrolled past the hero so it doesn't
 * compete with the in-hero CTA.
 *
 * Desktop renders nothing. Respects `prefers-reduced-motion` (no slide-up
 * transition, just a fade) and is hidden when the on-screen keyboard is
 * likely open (visualViewport heuristic).
 *
 * @module components/vuzora/StickyMobileCta
 */

import { useEffect, useState } from "react";
import { LINKS } from "@/content/vuzora";

export function StickyMobileCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    let current = false;
    const compute = () => {
      raf = 0;
      const next = window.scrollY > 600;
      if (next !== current) {
        current = next;
        setVisible(next);
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-all duration-300 ease-out lg:hidden ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
      style={{ zIndex: "var(--z-sticky)" as unknown as number }}
    >
      <a
        href={LINKS.genericBotUrl}
        data-cta="generic-conversion"
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={visible ? 0 : -1}
        className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/95 px-4 py-3 text-ink shadow-[0_20px_60px_-20px_rgba(79,60,255,0.6)] backdrop-blur-xl"
      >
        <span className="flex flex-col leading-tight">
          <span className="font-display text-[15px] font-semibold tracking-tight">
            Открыть в Telegram
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Бесплатно до 31.10.2026
          </span>
        </span>
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </a>
    </div>
  );
}

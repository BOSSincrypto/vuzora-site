/**
 * Tiny mono-spaced label used as an eyebrow above section headings and
 * inside cards (e.g. "07:00 МСК · ежедневно"). Visual primitive only.
 *
 * @module components/vuzora/ui/Kicker
 */

import type { ReactNode } from "react";

/**
 * Props for {@link Kicker}.
 *
 * @property children  Label content; usually a short uppercase string.
 * @property dot       When `true`, renders a small amber dot before the text.
 *                     Useful for "live"/"ежедневно" indicators.
 * @property tone      `"amber"` for highlighted callouts, `"muted"` (default)
 *                     for ambient labels.
 * @property className Extra Tailwind classes appended to the root span.
 */
type KickerProps = {
  children: ReactNode;
  dot?: boolean;
  tone?: "amber" | "muted";
  className?: string;
};

/** Render a single eyebrow/kicker label. */
export function Kicker({ children, dot = false, tone = "muted", className = "" }: KickerProps) {
  const color = tone === "amber" ? "text-amber/90" : "text-white/45";
  return (
    <span
      className={`inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] ${color} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />}
      {children}
    </span>
  );
}

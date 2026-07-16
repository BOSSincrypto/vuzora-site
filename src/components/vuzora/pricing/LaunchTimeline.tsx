/**
 * Vertical launch timeline shown in the left column of the Pricing section.
 *
 * Renders {@link TIMELINE} as an `<ol>` with an amber dot per milestone.
 *
 * @module components/vuzora/pricing/LaunchTimeline
 */

import { TIMELINE } from "@/content/vuzora";

/** Render the launch / free-period / trial timeline. */
export function LaunchTimeline() {
  return (
    <ol className="space-y-6 border-l border-white/10 pl-6">
      {TIMELINE.map((t) => (
        <li key={t.date} className="relative">
          <span
            className="absolute -left-[27px] top-2 h-2 w-2 rounded-full bg-amber"
            aria-hidden
          />
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">
            {t.date}
          </div>
          <div className="mt-1 font-display text-base font-semibold text-white">
            {t.label}
          </div>
          <p className="mt-1 max-w-[40ch] text-sm text-white/65">{t.body}</p>
        </li>
      ))}
    </ol>
  );
}

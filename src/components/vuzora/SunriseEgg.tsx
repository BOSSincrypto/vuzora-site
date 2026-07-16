/**
 * SunriseEgg — easter egg badge that appears between 06:55 and 07:05 МСК.
 *
 * Small amber pill that softly pulses, reminding visitors that right now,
 * in real time, every Vuzora user is receiving today's schedule. Renders
 * `null` outside the window so layout never shifts.
 *
 * @module components/vuzora/SunriseEgg
 */

import { memo, useMemo } from "react";
import { useTick } from "@/hooks/use-tick";

/** Cached Moscow formatter — same approach as LiveClock. */
const MSK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Moscow",
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
});

function isSunriseWindow(d: Date): boolean {
  try {
    const parts = MSK.formatToParts(d);
    const lookup: Record<string, string> = {};
    for (const p of parts) lookup[p.type] = p.value;
    const h = Number(lookup.hour) % 24;
    const m = Number(lookup.minute);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
    // 06:55 - 07:05 МСК
    if (h === 6 && m >= 55) return true;
    if (h === 7 && m <= 5) return true;
    return false;
  } catch {
    return false;
  }
}

function SunriseEggImpl({ className = "" }: { className?: string }) {
  const now = useTick();
  const visible = useMemo(() => (now ? isSunriseWindow(now) : false), [now]);
  if (!visible) return null;

  return (
    <span
      className={`sunrise-pulse inline-flex items-center gap-2 rounded-full border border-amber/50 bg-amber/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-amber ${className}`}
      role="status"
      aria-live="polite"
    >
      <span
        className="relative inline-flex h-2 w-2 rounded-full bg-amber"
        aria-hidden
      />
      Сейчас идёт доставка
    </span>
  );
}

export const SunriseEgg = memo(SunriseEggImpl);

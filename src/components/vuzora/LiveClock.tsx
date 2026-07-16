/**
 * Live time-display components for the Vuzora landing page.
 *
 * Both components subscribe to the shared {@link useTick} hook (single global
 * 1 Hz interval) and project the current instant into Moscow wall-clock time
 * via the IANA `Europe/Moscow` zone. On the server and during the first
 * client paint the value is `null`; we render stable fallbacks to keep
 * markup hydration-safe.
 *
 * @module components/vuzora/LiveClock
 */

import { memo, useMemo } from "react";
import { useTick } from "@/hooks/use-tick";

/** Placeholder shown before the first tick / on invalid input. */
const CLOCK_FALLBACK = "--:--:--";
/** Placeholder for the countdown component before the first tick. */
const COUNTDOWN_FALLBACK = "-- ч  -- мин  -- сек";

/** Zero-pad a number to two digits (`7` → `"07"`). */
function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Type-guard: `true` only for `Date` objects whose timestamp is finite. */
function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/**
 * Cached Moscow formatter. Constructing `Intl.DateTimeFormat` on every tick
 * is measurable on low-end devices; built once at module load. `en-GB`
 * forces predictable 24h numeric `formatToParts` output regardless of the
 * user's locale.
 */
const MSK_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Moscow",
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Decoded Moscow wall-clock components for a given instant. */
type MoscowParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/**
 * Decode an instant into Moscow wall-clock parts using the IANA TZ database.
 * Robust across user time zones; doesn't rely on a hardcoded UTC+3 offset
 * (so it still works if Russia ever reintroduces DST).
 *
 * @returns Numeric parts in Moscow, or `null` if input is invalid.
 */
function getMoscowParts(d: Date): MoscowParts | null {
  if (!isValidDate(d)) return null;
  try {
    const lookup: Record<string, string> = {};
    for (const p of MSK_FORMAT.formatToParts(d)) lookup[p.type] = p.value;
    const out: MoscowParts = {
      year: Number(lookup.year),
      month: Number(lookup.month),
      day: Number(lookup.day),
      hour: Number(lookup.hour) % 24, // some engines emit "24" at midnight
      minute: Number(lookup.minute),
      second: Number(lookup.second),
    };
    for (const v of Object.values(out)) {
      if (!Number.isFinite(v)) return null;
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Renders the current Moscow wall-clock time as `HH:MM:SS`, updated once a
 * second.
 *
 * @param props.className Optional extra Tailwind classes appended to the span.
 */
function LiveClockImpl({ className = "" }: { className?: string }) {
  const now = useTick();
  const text = useMemo(() => {
    if (!now) return CLOCK_FALLBACK;
    const p = getMoscowParts(now);
    if (!p) return CLOCK_FALLBACK;
    return `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
  }, [now]);

  return (
    <span
      className={`tabular font-mono ${className}`}
      role="timer"
      // Polite live region would announce every second; leave silent.
      aria-live="off"
      aria-label="Текущее время в Москве"
    >
      {/* `key={text}` restarts the .live-tick fade animation on each new value */}
      <span key={text} className="live-tick inline-block">{text}</span>
    </span>
  );
}

/**
 * Renders the time remaining until the next 07:00 МСК delivery window in
 * `HH ч  MM мин  SS сек` format. The countdown is computed entirely in
 * Moscow wall-clock arithmetic, so it stays correct for users in any zone.
 *
 * @param props.className Optional extra Tailwind classes appended to the span.
 */
function UntilNextDeliveryImpl({ className = "" }: { className?: string }) {
  const now = useTick();
  const text = useMemo(() => {
    if (!now) return COUNTDOWN_FALLBACK;
    const p = getMoscowParts(now);
    if (!p) return COUNTDOWN_FALLBACK;
    try {
      // Convert Moscow-local seconds-of-day to ms-since-start-of-MSK-day.
      const msIntoDay =
        (p.hour * 3600 + p.minute * 60 + p.second) * 1000;
      const target = 7 * 3600 * 1000; // 07:00:00 МСК in ms
      let diff = target - msIntoDay;
      // After 07:00 МСК roll forward to tomorrow's window.
      if (diff <= 0) diff += 24 * 3600 * 1000;
      if (!Number.isFinite(diff)) return COUNTDOWN_FALLBACK;

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      return `${pad(h)} ч  ${pad(m)} мин  ${pad(s)} сек`;
    } catch {
      return COUNTDOWN_FALLBACK;
    }
  }, [now]);

  return (
    <span
      className={`tabular font-mono ${className}`}
      role="timer"
      aria-live="off"
      aria-label="До следующей доставки расписания"
    >
      {text}
    </span>
  );
}

// Memoize: props are stable strings; only the internal tick should trigger work.
export const LiveClock = memo(LiveClockImpl);
export const UntilNextDelivery = memo(UntilNextDeliveryImpl);

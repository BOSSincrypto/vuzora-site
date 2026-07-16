/**
 * Shared 1 Hz clock tick.
 *
 * Every component that needs the current time (LiveClock, UntilNextDelivery,
 * future countdowns, …) subscribes to one global `setInterval` instead of
 * spinning up its own. This keeps the JS main-thread cost flat regardless of
 * how many clocks are rendered.
 *
 * Behaviour:
 *  - The interval starts the first time a subscriber mounts and is torn down
 *    when the last subscriber unmounts.
 *  - When the tab becomes hidden, the interval is paused. When it becomes
 *    visible again, we emit one immediate update so clocks catch up.
 *  - Subscriber callbacks are wrapped in try/catch so one broken consumer
 *    cannot stop the tick for everyone else.
 *
 * @module hooks/use-tick
 */

import { useEffect, useState } from "react";

/** All currently mounted subscribers. Mutated by start/stop logic. */
const subscribers = new Set<(now: Date) => void>();
/** Active `setInterval` handle, or `null` when the tick is paused/stopped. */
let intervalId: ReturnType<typeof setInterval> | null = null;
/** Guard so the `visibilitychange` listener is bound at most once per page. */
let visibilityBound = false;

/**
 * Push the current time to every subscriber.
 * Errors thrown by a subscriber are logged and swallowed.
 */
function emit() {
  const now = new Date();
  subscribers.forEach((cb) => {
    try {
      cb(now);
    } catch (err) {
      // A misbehaving subscriber must never break the shared tick.
      console.error("[useTick] subscriber threw", err);
    }
  });
}

/**
 * Start the 1 Hz interval if it isn't already running.
 * No-op when the tab is hidden (we let `bindVisibility` resume it later).
 */
function start() {
  if (intervalId !== null) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  intervalId = setInterval(emit, 1000);
}

/** Stop the interval; safe to call when already stopped. */
function stop() {
  if (intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
}

/**
 * Lazily attach the `visibilitychange` listener once per page load.
 * Pauses the tick in background tabs and resumes (with one immediate emit)
 * when the tab returns to the foreground.
 */
function bindVisibility() {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      emit();
      start();
    } else {
      stop();
    }
  });
}

/**
 * Subscribe the calling component to the shared 1 Hz tick.
 *
 * Returns `null` during SSR and on the first client render (before the
 * effect runs) so that markup is deterministic and hydration matches.
 * Consumers should render a fallback (e.g. `--:--:--`) while the value is
 * `null` and re-render normally once a `Date` arrives.
 *
 * @returns The most recent tick `Date`, or `null` before the first tick.
 */
export function useTick(): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    bindVisibility();
    // Emit one value immediately so the consumer doesn't wait ~1s for the
    // first tick after mount.
    setNow(new Date());
    subscribers.add(setNow);
    start();
    return () => {
      subscribers.delete(setNow);
      // Stop the global interval when nothing is listening anymore.
      if (subscribers.size === 0) stop();
    };
  }, []);

  return now;
}

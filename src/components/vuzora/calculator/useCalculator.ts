/**
 * useCalculator — extracts state, URL hydration, derived stats and share
 * behaviour for the "Калькулятор тишины" block so the component file stays
 * focused on layout.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Average minutes spent per manual check of the university schedule. */
export const MINUTES_PER_CHECK = 3;
/** Approx. study weeks per academic year (used for the yearly stat). */
export const SCHOOL_WEEKS = 36;

/** Slider bounds. Exposed so the JSX stays declarative. */
export const CHECKS_MIN = 1;
export const CHECKS_MAX = 10;
const CHECKS_DEFAULT = 2;

export type ShareState = "idle" | "copied" | "shared" | "error";

/** Clamp arbitrary input to the slider's valid integer range. */
export function clampChecks(n: number): number {
  if (!Number.isFinite(n)) return CHECKS_DEFAULT;
  return Math.min(CHECKS_MAX, Math.max(CHECKS_MIN, Math.round(n)));
}

/**
 * Encapsulates all behaviour of the calculator block:
 *  - `checks` + setter (always clamped),
 *  - `perWeek` / `perYearH` derived stats,
 *  - `share` action + transient status,
 *  - hydration from `?checks=` on mount.
 */
export function useCalculator() {
  const [checks, setChecksRaw] = useState(CHECKS_DEFAULT);
  const [shared, setShared] = useState<ShareState>("idle");

  const setChecks = useCallback(
    (n: number) => setChecksRaw(clampChecks(n)),
    [],
  );

  // Hydrate from ?checks= on mount (client-only). Wrapped in try/catch because
  // URL parsing throws on malformed `window.location.search` in some embeds.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = new URLSearchParams(window.location.search).get("checks");
      if (raw == null) return;
      const n = Number(raw);
      if (Number.isFinite(n)) setChecksRaw(clampChecks(n));
    } catch (err) {
      console.warn("[vuzora:calculator] failed to hydrate ?checks=", err);
    }
  }, []);

  const { perWeek, perYearH } = useMemo(() => {
    const minutesWeek = checks * MINUTES_PER_CHECK * 5; // 5 study days
    const minutesYear = minutesWeek * SCHOOL_WEEKS;
    return {
      perWeek: minutesWeek,
      perYearH: (minutesYear / 60).toFixed(1),
    };
  }, [checks]);

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  const flash = useCallback((state: ShareState) => {
    if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    setShared(state);
    flashTimerRef.current = setTimeout(() => {
      flashTimerRef.current = null;
      setShared("idle");
    }, 2200);
  }, []);

  const share = useCallback(async () => {
    if (typeof window === "undefined") return;

    let link = "";
    try {
      const url = new URL(window.location.href);
      url.hash = "calc";
      url.searchParams.set("checks", String(checks));
      link = url.toString();
    } catch (err) {
      console.error("[vuzora:calculator] cannot build share URL", err);
      flash("error");
      return;
    }

    const text = `Я теряю ${perYearH} часов в год, открывая расписание ${checks} раз в день. Vuzora забирает это утро на себя.`;

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Vuzora · калькулятор тишины", text, url: link });
        flash("shared");
      } else if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text}\n${link}`);
        flash("copied");
      } else {
        // No Web Share, no clipboard API – surface the error state so the
        // button label tells the user to try again rather than firing a
        // blocking window.prompt() that some browsers treat as a phishing UI.
        flash("error");
      }

    } catch (err) {
      // AbortError = user cancelled the native share sheet — that's fine.
      const name = (err as { name?: string } | null)?.name;
      if (name === "AbortError") return;
      console.warn("[vuzora:calculator] share failed", err);
      flash("error");
    }
  }, [checks, perYearH, flash]);

  return { checks, setChecks, perWeek, perYearH, shared, share };
}

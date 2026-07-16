/**
 * useReveal — minimal IntersectionObserver hook.
 *
 * Adds `data-revealed="true"` to the element once it scrolls into view.
 * Pair with the `.reveal` utility in styles.css for a single, restrained
 * fade-up. Under `prefers-reduced-motion: reduce`, missing IntersectionObserver,
 * or reduced-data / Save-Data, content is revealed immediately so required
 * copy never depends on timers or observers.
 */
import { useEffect, useRef } from "react";

function shouldRevealImmediately(): boolean {
  if (typeof window === "undefined") return true;
  if (typeof IntersectionObserver === "undefined") return true;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  if (window.matchMedia("(prefers-reduced-data: reduce)").matches) return true;
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean };
    }
  ).connection;
  if (connection?.saveData) return true;
  return false;
}

export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
) {
  const ref = useRef<T | null>(null);
  // Serialise primitive fields so callers can pass a fresh object literal
  // each render without re-creating the observer on every render — but
  // still re-attach if the meaningful options actually change.
  const optionsKey = JSON.stringify({
    root: null,
    rootMargin: options?.rootMargin ?? "0px 0px -10% 0px",
    threshold: options?.threshold ?? 0.15,
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!el.dataset.motionSurface) {
      el.dataset.motionSurface = "reveal";
    }

    if (shouldRevealImmediately()) {
      el.dataset.revealed = "true";
      return;
    }

    const parsed = JSON.parse(optionsKey) as IntersectionObserverInit;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          el.dataset.revealed = "true";
          io.unobserve(el);
        }
      }
    }, parsed);
    io.observe(el);
    return () => io.disconnect();
  }, [optionsKey]);
  return ref;
}

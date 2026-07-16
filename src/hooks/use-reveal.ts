/**
 * useReveal — minimal IntersectionObserver hook.
 *
 * Adds `data-revealed="true"` to the element once it scrolls into view.
 * Pair with the `.reveal` utility in styles.css for a single, restrained
 * fade-up. Respects `prefers-reduced-motion` via CSS (no transform when set).
 */
import { useEffect, useRef } from "react";

export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit
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
    if (!el || typeof IntersectionObserver === "undefined") return;
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

/**
 * useReadProgress – returns 0..1 reading progress for a target element.
 *
 * Computes how much of the element has scrolled past the viewport top,
 * normalised against the element's scrollable extent. SSR-safe (returns 0
 * before mount). Updates on scroll/resize via passive listeners and rAF
 * throttling.
 *
 * @module hooks/use-read-progress
 */

import { useEffect, useRef, useState } from "react";

/** Hook: returns a [0..1] progress value for the referenced element. */
export function useReadProgress<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    let lastEmitted = -1;

    const compute = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // Distance from element top to viewport top, clamped to element height.
      const total = Math.max(1, rect.height - vh);
      const passed = Math.min(Math.max(0, -rect.top), total);
      const next = passed / total;
      // Suppress sub-pixel React re-renders. Saves dozens of renders/sec
      // during fast scroll on long posts.
      if (Math.abs(next - lastEmitted) < 0.005) return;
      lastEmitted = next;
      setProgress(next);
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return { ref, progress };
}

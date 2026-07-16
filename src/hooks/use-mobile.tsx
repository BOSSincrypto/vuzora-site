/**
 * `useIsMobile` — reactive boolean for "viewport is narrower than the
 * Tailwind `md` breakpoint" (≤ 767 px).
 *
 * Backed by `matchMedia` so it updates as the user resizes / rotates the
 * device, without a scroll/resize-listener spam. SSR-safe: returns `false`
 * on the server and during the first client render (before the effect
 * resolves), so components stay hydration-stable.
 *
 * @module hooks/use-mobile
 */

import * as React from "react";

/** Width (px) at which the layout flips from mobile to desktop. */
const MOBILE_BREAKPOINT = 768;

/**
 * Subscribe the calling component to viewport-width changes.
 *
 * @returns `true` when the viewport is narrower than {@link MOBILE_BREAKPOINT},
 *          otherwise `false`. Always `false` during SSR / first paint.
 */
export function useIsMobile() {
  // `undefined` until the first effect run so we can distinguish "not yet
  // measured" from "definitely desktop" if a consumer wants to branch on it.
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    // Seed once on mount so consumers don't wait for the first resize event.
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/**
 * ReadProgress – thin amber bar at the top of the viewport that tracks how
 * far the user has scrolled through a long-form post.
 *
 * Uses `transform: scaleX()` (compositor-only) instead of animating width
 * (triggers layout each frame). The 120 ms transition smooths sub-pixel
 * jitter without lagging fast scrolls. Memoized so re-render cost is just a
 * prop diff, not a virtual-DOM walk.
 *
 * @module components/vuzora/ReadProgress
 */

import { memo } from "react";

type Props = {
  /** 0..1 scroll progress through the article. */
  progress: number;
};

function ReadProgressImpl({ progress }: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] bg-transparent"
    >
      <div
        className="h-full w-full origin-left bg-amber/80 transition-transform duration-150 ease-out will-change-transform"
        style={{
          transform: `scaleX(${clamped})`,
          boxShadow: "0 0 12px rgba(255, 176, 32, 0.6)",
        }}
      />
    </div>
  );
}

export const ReadProgress = memo(ReadProgressImpl);

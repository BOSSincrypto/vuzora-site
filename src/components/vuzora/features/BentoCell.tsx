/**
 * Generic bento-grid cell — bordered rounded surface with consistent padding.
 *
 * Used by {@link FeatureBento} to give every tile the same visual baseline
 * while letting parents drive sizing through grid utility classes.
 *
 * @module components/vuzora/features/BentoCell
 */

import type { ReactNode } from "react";

/**
 * @param className Tailwind classes that drive grid placement / sizing.
 * @param children  Cell contents.
 */
export function BentoCell({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`lift rounded-2xl border border-white/10 bg-ink-soft/40 p-6 md:p-8 ${className}`}
    >
      {children}
    </div>
  );
}

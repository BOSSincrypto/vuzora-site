/**
 * DeferredSection — wraps a landing-page section with two cross-cutting
 * concerns kept out of every individual block:
 *
 *  1. `content-visibility: auto` (the `cv-auto` utility) so off-screen
 *     sections skip paint/layout until they approach the viewport, which
 *     improves initial render and scroll smoothness.
 *  2. A labelled {@link ErrorBoundary} so a single broken block degrades
 *     gracefully instead of blanking the whole page.
 *
 * Pass `defer={false}` for above-the-fold content (the hero) where we want
 * the LCP candidate to paint immediately.
 */
import type { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

export interface DeferredSectionProps {
  /** Human-readable label surfaced in error logs. */
  label: string;
  /** Optional fallback UI used when the boundary catches an error. */
  fallback?: ReactNode;
  /** Apply `content-visibility: auto`. Default `true`. */
  defer?: boolean;
  children: ReactNode;
}

export function DeferredSection({ label, fallback, defer = true, children }: DeferredSectionProps) {
  const boundary = (
    <ErrorBoundary label={label} fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
  return defer ? <div className="cv-auto">{boundary}</div> : boundary;
}

/**
 * Thin client-side bridge to Lovable's in-preview error reporter.
 *
 * The Lovable preview shell exposes `window.__lovableEvents.captureException`
 * which streams errors into the agent's "runtime errors" feed. This module
 * lets app code (error boundaries, route fallbacks) forward exceptions
 * without depending on Lovable internals directly — when the global is
 * absent (production publish, plain browser) the calls become no-ops.
 *
 * @module lib/lovable-error-reporting
 */

/**
 * Metadata about *how* an error was captured. Mirrors Sentry conventions
 * so the Lovable shell can categorise events consistently.
 */
type LovableErrorOptions = {
  /** Where the error originated (manual call, window.onerror, …). */
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  /** `true` if the app recovered gracefully, `false` for crashes. */
  handled?: boolean;
  /** Severity level for filtering in the report stream. */
  severity?: "error" | "warning" | "info";
};

/** Shape of the Lovable preview's global event sink (subset we use). */
type LovableEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    /** Injected by the Lovable preview iframe; undefined elsewhere. */
    __lovableEvents?: LovableEvents;
  }
}

/**
 * Forward an error (and optional structured context) to the Lovable preview
 * shell. Safe to call from any client code path — does nothing during SSR
 * or when the preview shell isn't present.
 *
 * @param error   The thrown value (Error, string, anything).
 * @param context Extra key/value pairs attached to the report. The current
 *                pathname and a `react_error_boundary` source tag are added
 *                automatically.
 */
export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.__lovableEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
}

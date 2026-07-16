/**
 * Out-of-band SSR error capture.
 *
 * h3 (the request layer under TanStack Start) catches in-handler throws
 * and turns them into a generic `Response` with body
 * `{"unhandled":true,"message":"HTTPError"}`. The original `Error` never
 * reaches our wrapper in `src/server.ts`, so we can't log a stack trace
 * from a normal try/catch.
 *
 * Workaround: install `globalThis` listeners and stash the most recent
 * thrown error in a tiny in-memory cache. When the wrapper detects an
 * h3-swallowed 500, it pulls the captured error and logs it.
 *
 * The TTL prevents stale, unrelated errors from being attributed to a
 * later request.
 *
 * @module lib/error-capture
 */

/** Most recently observed uncaught error + the timestamp it was recorded. */
let lastCapturedError: { error: unknown; at: number } | undefined;
/** How long a captured error stays correlatable (ms). */
const TTL_MS = 5_000;

/** Store the latest error. Called from the global listeners. */
function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

// Arm the listeners at module load — importing this file for its side
// effect (from `src/server.ts`) is what enables capture.
if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

/**
 * Pop the most recent captured error if it's still within {@link TTL_MS}.
 * Returns `undefined` when nothing was captured or the entry is stale.
 *
 * Single-shot: subsequent calls return `undefined` until a new error fires.
 */
export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}

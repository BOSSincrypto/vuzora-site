/**
 * Out-of-band SSR error capture.
 *
 * h3 (the request layer under TanStack Start) catches in-handler throws
 * and turns them into a generic `Response` with body
 * `{"unhandled":true,"message":"HTTPError"}`. The original `Error` never
 * reaches our wrapper in `src/server.ts`, so we can't log a stack trace
 * from a normal try/catch.
 *
 * Workaround: install `globalThis` listeners and stash a thrown error while
 * the request wrapper is active. When the wrapper detects an h3-swallowed 500,
 * it pulls the captured error and logs it.
 *
 * The TTL prevents stale, unrelated errors from being attributed to a
 * later request. Concurrent requests are deliberately treated as ambiguous:
 * the wrapper logs a generic error instead of attributing one request's error
 * to another.
 *
 * @module lib/error-capture
 */

/** Most recently observed uncaught error + the request concurrency at capture. */
let lastCapturedError: { error: unknown; at: number; activeRequests: number } | undefined;
/** Number of server requests currently inside the outer fetch wrapper. */
let activeRequests = 0;
/** How long a captured error stays correlatable (ms). */
const TTL_MS = 5_000;

/** Store the latest error. Called from the global listeners. */
function record(error: unknown) {
  if (activeRequests === 0) return;
  lastCapturedError = { error, at: Date.now(), activeRequests };
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
 * Mark one outer server request as active and return its idempotent cleanup.
 * Captures are only attributable while exactly one request is active.
 */
export function startErrorCaptureRequest(): () => void {
  activeRequests += 1;
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    activeRequests -= 1;
    if (activeRequests === 0) lastCapturedError = undefined;
  };
}

/**
 * Pop the most recent captured error if it's still within {@link TTL_MS}.
 * Returns `undefined` when nothing was captured or the entry is stale.
 *
 * Single-shot: subsequent calls return `undefined` until a new error fires.
 */
export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  // A global listener cannot identify which concurrent request emitted an
  // event. Refuse attribution whenever the capture happened amid concurrency.
  if (activeRequests !== 1 || lastCapturedError.activeRequests !== 1) {
    lastCapturedError = undefined;
    return undefined;
  }
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}

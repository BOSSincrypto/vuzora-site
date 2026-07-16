/**
 * Section-scoped React error boundary used across the Vuzora landing page.
 *
 * Each major landing section is wrapped in its own boundary so that a render
 * crash in one block (e.g. a broken Date helper, a third-party widget) shows
 * a friendly fallback in place instead of blanking the whole page.
 *
 * @module components/vuzora/ui/ErrorBoundary
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Props for {@link ErrorBoundary}.
 *
 * @property children  Subtree to render and protect.
 * @property label     Short identifier prepended to console errors
 *                     (e.g. `"hero"`, `"pricing"`). Defaults to `"section"`.
 * @property fallback  Custom node to render when an error is caught. When set
 *                     to `null` the section silently disappears (used for the
 *                     nav/footer where a placeholder would look worse).
 * @property onError   Optional reporting hook called once per caught error.
 *                     Wrapped in try/catch so analytics failures cannot
 *                     re-throw out of `componentDidCatch`.
 */
type Props = {
  children: ReactNode;
  label?: string;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
};

/** Internal state — either no error, or the caught `Error` instance. */
type State = { error: Error | null };

/**
 * Class component because React still has no hook-based equivalent for
 * `componentDidCatch` / `getDerivedStateFromError`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  /**
   * React lifecycle: convert a thrown error into a state update so the next
   * render shows the fallback.
   */
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  /**
   * React lifecycle: log the error and notify the optional reporter.
   * Never throws — logging failures are swallowed.
   */
  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      console.error(`[vuzora:${this.props.label ?? "section"}]`, error, info);
      this.props.onError?.(error, info);
    } catch {
      /* swallow – never let logging crash the boundary */
    }
  }

  /**
   * Clear the error and re-attempt rendering the protected subtree.
   * Bound as a class field so it can be passed directly to `onClick`.
   */
  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    // Happy path: pass children through untouched.
    if (!this.state.error) return this.props.children;
    // Caller opted into a custom fallback (including explicit `null`).
    if (this.props.fallback !== undefined) return this.props.fallback;

    // Default friendly card with a retry button.
    return (
      <div
        role="alert"
        className="mx-auto my-8 max-w-xl rounded-2xl border border-white/10 bg-ink-soft/60 p-6 text-center"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber/90">
          Что-то пошло не так
        </p>
        <p className="mt-3 text-sm text-white/70">
          Этот блок не смог отрисоваться. Остальная часть страницы работает как обычно.
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs text-white/80 transition-colors hover:border-amber hover:text-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          Попробовать снова
        </button>
      </div>
    );
  }
}

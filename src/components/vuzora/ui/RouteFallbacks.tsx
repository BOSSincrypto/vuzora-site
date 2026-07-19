/**
 * Shared route-level fallback UIs.
 *
 * `RouteErrorFallback` — branded error screen used by TanStack Router's
 *   `errorComponent` / `defaultErrorComponent`. Logs the error, offers
 *   "try again" (invalidates the loader) and "go home".
 * `RouteNotFoundFallback` — branded 404 used by route-level
 *   `notFoundComponent`.
 *
 * Kept dependency-light (no data hooks) so it works in every boundary.
 */

import { useEffect } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { BLOG_INDEX_PATH } from "@/content/blog";

type ErrorProps = {
  error: Error;
  reset: () => void;
  label?: string;
  title?: string;
  description?: string;
};

export function RouteErrorFallback({
  error,
  reset,
  label = "route",
  title = "Страница не загрузилась",
  description = "Что-то пошло не так на нашей стороне. Попробуй ещё раз или вернись на главную – расписание подождёт.",
}: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    try {
      console.error(`[vuzora:${label}]`, error);
      reportLovableError(error, { boundary: `route:${label}` });
    } catch {
      /* never let reporting crash the fallback */
    }
  }, [error, label]);

  return (
    <div className="grain flex min-h-screen items-center justify-center bg-ink px-6 text-white">
      <div className="max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber/80">
          Сбой · но не в расписании
        </p>
        <h1
          className="mt-4 font-display text-white"
          style={{
            fontSize: "clamp(2rem, 5vw, 2.75rem)",
            lineHeight: 1.1,
            fontWeight: 800,
            letterSpacing: "-0.035em",
          }}
        >
          {title}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-white/65">{description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              try {
                router.invalidate();
              } finally {
                reset();
              }
            }}
            className="inline-flex items-center justify-center rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-amber/90"
          >
            Попробовать снова
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/5"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

type NotFoundProps = {
  title?: string;
  description?: string;
  primaryHref?: string;
  primaryLabel?: string;
};

export function RouteNotFoundFallback({
  title = "Такой страницы нет",
  description = "Страница не нашлась. Это не страшно – расписание подождёт. Вернись на главную или загляни в блог.",
  primaryHref = "/",
  primaryLabel = "На главную",
}: NotFoundProps = {}) {
  return (
    <div className="grain flex min-h-screen items-center justify-center bg-ink px-6 text-white">
      <div className="max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber/80">
          404 · Тишина
        </p>
        <h1
          className="mt-4 font-display text-white"
          style={{
            fontSize: "clamp(2.5rem, 7vw, 4rem)",
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: "-0.04em",
          }}
        >
          {title}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-white/65">{description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to={primaryHref}
            className="inline-flex items-center justify-center rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-amber/90"
          >
            {primaryLabel}
          </Link>
          <a
            href={BLOG_INDEX_PATH}
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/5"
          >
            В блог
          </a>
        </div>
      </div>
    </div>
  );
}

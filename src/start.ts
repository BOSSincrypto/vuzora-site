import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

/**
 * Catches uncaught server errors and serves a friendly HTML fallback
 * instead of leaking the stack to the client.
 */
const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Adds baseline security response headers to every server response.
 *
 * BOUNDARY: the production release is a static GitHub Pages artifact, and
 * Pages does not run this middleware — these headers reach `vite dev`,
 * `vite preview`, and any future server runtime only. Treat the deployed
 * origin as having no CSP and no `X-Frame-Options` until an edge layer sets
 * them (see AGENT-DISCOVERY-EDGE-RUNBOOK.md); do not cite this file as
 * evidence that production is protected.
 *
 * - `X-Frame-Options: DENY` запрещает встраивание сайта в iframe (clickjacking).
 * - `X-Content-Type-Options: nosniff` отключает MIME-sniffing.
 * - `Referrer-Policy: strict-origin-when-cross-origin` не утекает путь на сторонние домены.
 * - `Permissions-Policy` – закрывает неиспользуемые API браузера.
 * - `Content-Security-Policy` – разрешает только собственные источники и Telegram navigation.
 *   CSP оставлен умеренно открытым (style-src 'unsafe-inline') – Tailwind v4 и JSON-LD требуют этого.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' mailto:",
  ].join("; "),
};

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const response = await next();
  if (response instanceof Response) {
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      if (!response.headers.has(key)) response.headers.set(key, value);
    }
  }
  return response;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, securityHeadersMiddleware],
}));

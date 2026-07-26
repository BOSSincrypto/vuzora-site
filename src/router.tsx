/**
 * Router factory.
 *
 * TanStack Start invokes {@link getRouter} once per request (SSR) and once
 * per page load (browser).
 *
 * Globally registered here:
 *  - `defaultErrorComponent` — branded fallback when a route's own
 *    `errorComponent` isn't set.
 *  - `defaultNotFoundComponent` — branded 404 for unmatched URLs.
 *
 * @module router
 */

import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteErrorFallback, RouteNotFoundFallback } from "./components/vuzora/ui/RouteFallbacks";

/**
 * Build a configured TanStack Router instance.
 *
 * @returns A router ready to be handed to `RouterProvider` (client) or
 *          TanStack Start's SSR entry (server).
 */
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    // GitHub Pages serves every prerendered route from `<route>/index.html`, so
    // the slashless form 301-redirects. The router default is "never", which
    // would emit exactly that redirecting form from every <Link>. With
    // `trailingSlash: "always"` the generated `to` union spells page routes in
    // the canonical slashed form — write `to` props with the slash, as the
    // rest of the codebase does.
    trailingSlash: "always",
    defaultErrorComponent: ({ error, reset }) => (
      <RouteErrorFallback error={error} reset={reset} label="default" />
    ),
    defaultNotFoundComponent: () => <RouteNotFoundFallback />,
  });

  return router;
};

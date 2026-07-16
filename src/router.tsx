/**
 * Router factory.
 *
 * TanStack Start invokes {@link getRouter} once per request (SSR) and once
 * per page load (browser). Returning a fresh `QueryClient` per call is
 * critical: a module-level singleton would leak cached query data between
 * concurrent server requests.
 *
 * Globally registered here:
 *  - `defaultErrorComponent` — branded fallback when a route's own
 *    `errorComponent` isn't set.
 *  - `defaultNotFoundComponent` — branded 404 for unmatched URLs.
 *  - `defaultPreloadStaleTime: 0` — lets TanStack Query own cache
 *    freshness instead of the router's own SWR.
 *
 * @module router
 */

import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import {
  RouteErrorFallback,
  RouteNotFoundFallback,
} from "./components/vuzora/ui/RouteFallbacks";

/**
 * Build a configured TanStack Router instance with its own QueryClient.
 *
 * @returns A router ready to be handed to `RouterProvider` (client) or
 *          TanStack Start's SSR entry (server).
 */
export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Sane defaults so transient network blips don't blank a page.
        retry: 1,
        staleTime: 30_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ({ error, reset }) => (
      <RouteErrorFallback error={error} reset={reset} label="default" />
    ),
    defaultNotFoundComponent: () => <RouteNotFoundFallback />,
  });

  return router;
};

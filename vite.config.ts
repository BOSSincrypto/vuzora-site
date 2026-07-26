/**
 * Build configuration for the static GitHub Pages release.
 *
 * Plugin order matters and mirrors what TanStack Start expects: Tailwind and
 * tsconfig path resolution first, then `tanstackStart` (which owns routing,
 * SSR and the prerenderer), then the React transform.
 *
 * Every indexable route is an explicit registry-derived seed, so crawling
 * cannot silently omit a new detail page. `crawlLinks` stays off and prerender
 * errors fail the build.
 *
 * There is no server runtime in the release: Nitro is never loaded, and
 * `dist/` is a plain static tree.
 */
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

import { PRERENDER_ROUTES } from "./src/content/public-routes";

export default defineConfig({
  // Vite runs Lightning CSS at build but PostCSS in dev, so a build-only
  // transform can break the static output while the dev preview looks fine.
  // Pinning both to Lightning CSS keeps the preview honest.
  css: { transformer: "lightningcss" },
  resolve: {
    // `tsConfigPaths` already maps `@/*`; the alias keeps resolution working
    // for tools that read the Vite config without the tsconfig.
    alias: { "@": new URL("./src", import.meta.url).pathname },
    // A second copy of React or the query client breaks hooks and cache
    // identity across the SSR/client boundary.
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Keep server-only modules out of the client graph at build time rather
      // than discovering the leak at runtime.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      prerender: {
        enabled: true,
        crawlLinks: false,
        failOnError: true,
      },
      pages: PRERENDER_ROUTES.map((path) => ({ path })),
      sitemap: {
        enabled: true,
        host: "https://vuzora.ru",
      },
    }),
    viteReact(),
  ],
  environments: {
    client: {
      build: { outDir: "dist" },
    },
  },
});

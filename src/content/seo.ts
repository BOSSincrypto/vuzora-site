import { abs } from "./site";

/** Shared metadata for every public route in the indexable release manifest. */
export const INDEXABLE_META = [
  { name: "robots", content: "index, follow" },
  { property: "og:locale", content: "ru_RU" },
] as const;

/** Metadata for route-local 404 recovery, which must never be indexable. */
export const NOINDEX_META = [{ name: "robots", content: "noindex" }] as const;

/**
 * Keep machine-readable discovery reachable from ordinary HTML without
 * inventing a separate endpoint or relying on client-side navigation.
 */
export const DISCOVERY_LINKS = [
  {
    rel: "alternate",
    type: "application/rss+xml",
    title: "RSS блога",
    href: abs("/blog/rss.xml"),
  },
  {
    rel: "alternate",
    type: "text/plain",
    title: "Пакет для AI-краулеров",
    href: abs("/llms.txt"),
  },
  // RFC 9727 registers the `api-catalog` relation; web linking is
  // format-agnostic, so the HTML serialization carries the same meaning as a
  // Link response header — which GitHub Pages cannot emit. The catalog itself
  // states that Vuzora implements no HTTP API, so this advertises the
  // documented boundary, not an endpoint.
  {
    rel: "api-catalog",
    type: "application/linkset+json",
    title: "Каталог API-границы",
    href: abs("/.well-known/api-catalog"),
  },
] as const;

/**
 * Markdown mirror path for a public page path.
 *
 * The rule is the one agents already probe: drop the trailing slash and append
 * `.md`, so `/pricing/` mirrors at `/pricing.md` and `/unis/msu/` at
 * `/unis/msu.md`. The root is the one path with no name to drop, so it takes
 * `/index.md`. `scripts/markdown-mirrors.mjs` re-implements this rule and
 * `scripts/markdown-artifacts.test.mjs` pins the two together.
 */
export function markdownMirrorPath(pagePath: string): string {
  if (pagePath === "/") return "/index.md";
  return `${pagePath.replace(/\/+$/, "")}.md`;
}

/**
 * Route-local pointer to the page's Markdown mirror.
 *
 * `rel="alternate"` is the honest relation: the same content in another
 * representation, not a separate resource. GitHub Pages cannot negotiate on
 * `Accept`, so the HTML head is where the pointer lives.
 *
 * @param pagePath Canonical page path, e.g. `/pricing/`.
 */
export function markdownAlternateLink(pagePath: string) {
  return {
    rel: "alternate",
    type: "text/markdown",
    title: "Markdown-версия страницы",
    href: abs(markdownMirrorPath(pagePath)),
  } as const;
}

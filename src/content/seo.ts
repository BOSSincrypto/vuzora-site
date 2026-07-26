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

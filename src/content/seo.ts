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
] as const;

import { blogPostPath, POSTS } from "./blog";
import { universityDetailPaths } from "./universities";

const CORE_ROUTES = [
  "/",
  "/pricing/",
  "/unis/",
  "/blog/",
  "/changelog/",
  "/legal/terms/",
  "/legal/privacy/",
] as const;

// Derived through the helper so the seed list cannot drift from the public path.
const BLOG_ROUTES = POSTS.map((post) => blogPostPath(post.slug));
const UNIVERSITY_ROUTES = universityDetailPaths();

/** The complete registry-derived set of pages that must be statically rendered. */
export const PRERENDER_ROUTES = [...CORE_ROUTES, ...BLOG_ROUTES, ...UNIVERSITY_ROUTES] as const;

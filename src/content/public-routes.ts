import { POSTS } from "./blog";
import { UNIVERSITIES } from "./universities";

const CORE_ROUTES = [
  "/",
  "/pricing",
  "/unis",
  "/blog/",
  "/changelog",
  "/legal/terms",
  "/legal/privacy",
] as const;

const BLOG_ROUTES = POSTS.map((post) => `/blog/${post.slug}`);
const UNIVERSITY_ROUTES = UNIVERSITIES.flatMap((university) => {
  if ("slug" in university && typeof university.slug === "string") {
    return [`/unis/${university.slug}`];
  }
  return [];
});

/** The complete registry-derived set of pages that must be statically rendered. */
export const PRERENDER_ROUTES = [
  ...CORE_ROUTES,
  ...BLOG_ROUTES,
  ...UNIVERSITY_ROUTES,
] as const;

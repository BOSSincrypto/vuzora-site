/**
 * Honest `<lastmod>` dates for the release sitemap.
 *
 * Blog surfaces always carried a verifiable date from the post records. Every
 * other route carried the build day — and because `deploy.yml` rebuilds on a
 * daily cron, that told Google all 32 non-blog pages had changed, every single
 * day, forever. A `lastmod` that visibly does not track real edits is one
 * Google stops trusting, and it stops trusting the whole sitemap's freshness
 * signal with it. So ask git when a route's sources actually last changed.
 *
 * When git cannot answer — a shallow clone whose history does not reach the
 * commit that touched those paths, a tarball export, or the `.git`-less copy
 * `repeat:release` builds from — the route gets no `<lastmod>` element at all.
 * That is legal (`lastmod` is optional in the sitemap protocol) and it is the
 * only other honest answer: "unknown" beats a date we invented. `deploy.yml`
 * checks out full history so the published sitemap takes the git branch.
 *
 * Granularity is per source file, not per rendered pixel: all 25 university
 * pages read from one registry, so they share its date. A registry edit really
 * does rewrite every one of those pages' facts, so that is a claim we can
 * defend — unlike the build day, which claimed a change that never happened.
 *
 * @module scripts/route-lastmod
 */

import { execFileSync } from "node:child_process";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shape *and* calendar validity. `2026-13-99` matches the shape and would sail
 * past the release validator, which also only checks shape — one round trip
 * through `Date` rejects it here instead of shipping it.
 *
 * @param {unknown} value
 */
function isCalendarDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  // Invalid Date throws from toISOString, and a rolled-over date (2026-02-30
  // → March 2) round-trips to a different string.
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/** Sources that decide what a core route renders. */
const CORE_ROUTE_SOURCES = {
  // The homepage embeds the hero, calculator, feature bento, pricing teaser
  // and FAQ, so its content really is the shared component tree.
  "/": ["src/routes/index.tsx", "src/content", "src/components"],
  "/pricing/": [
    "src/routes/pricing.tsx",
    "src/content/pricing.ts",
    "src/components/vuzora/Pricing.tsx",
    "src/components/vuzora/pricing",
  ],
  "/unis/": [
    "src/routes/unis.tsx",
    "src/content/universities.ts",
    "src/components/vuzora/Universities.tsx",
  ],
  "/changelog/": ["src/routes/changelog.tsx", "src/content/changelog.ts"],
  "/legal/terms/": ["src/routes/legal.terms.tsx", "src/content/legal.ts"],
  "/legal/privacy/": ["src/routes/legal.privacy.tsx", "src/content/legal.ts"],
};

/** Sources behind every `/unis/<slug>/` detail page. */
const UNIVERSITY_DETAIL_SOURCES = ["src/routes/unis_.$slug.tsx", "src/content/universities.ts"];

/**
 * Source paths whose last commit dates a route, or `undefined` when the route
 * carries its own verifiable date (blog surfaces) and must not consult git.
 *
 * @param {string} route Canonical route path, e.g. `/unis/msu/`.
 */
export function sourcesFor(route) {
  if (CORE_ROUTE_SOURCES[route]) return CORE_ROUTE_SOURCES[route];
  if (route.startsWith("/unis/") && route !== "/unis/") return UNIVERSITY_DETAIL_SOURCES;
  return undefined;
}

/**
 * Run `git log` and return trimmed stdout, or `undefined` when git is absent,
 * the directory is not a repository, or the history does not reach a commit
 * touching those paths.
 *
 * @param {string[]} args
 * @param {string} cwd
 */
function runGit(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Commit date (`YYYY-MM-DD`) of the newest commit touching any of `paths`.
 *
 * @param {string[]} paths Repo-relative paths; missing ones are simply never matched.
 * @param {{ root?: string, git?: (args: string[], cwd: string) => string | undefined }} [options]
 * @returns {string | undefined}
 */
export function gitLastCommitDate(paths, { root = process.cwd(), git = runGit } = {}) {
  if (!paths?.length) return undefined;
  const out = git(["log", "-1", "--format=%cs", "--", ...paths], root);
  return isCalendarDate(out) ? out : undefined;
}

/**
 * Map every route to its `lastmod`, or to `undefined` when no date can be
 * proven. Blog routes take the committed post dates; everything else takes git.
 *
 * @param {{ routes: readonly string[], postRecords?: Array<{ slug: string, date: string }>, root?: string, git?: Function }} input
 * @returns {Map<string, string | undefined>}
 */
export function buildRouteLastmod({ routes, postRecords = [], root = process.cwd(), git = runGit }) {
  const postDateByRoute = new Map(postRecords.map((post) => [`/blog/${post.slug}/`, post.date]));
  const latestPostDate = postRecords.reduce(
    (latest, post) => (post.date > latest ? post.date : latest),
    "",
  );
  // One git call per distinct source set, not per route: the 25 detail pages
  // share theirs.
  const cache = new Map();
  const dateForSources = (paths) => {
    const key = paths.join(" ");
    if (!cache.has(key)) cache.set(key, gitLastCommitDate(paths, { root, git }));
    return cache.get(key);
  };

  const lastmod = new Map();
  for (const route of routes) {
    if (postDateByRoute.has(route)) {
      lastmod.set(route, postDateByRoute.get(route));
      continue;
    }
    if (route === "/blog/") {
      lastmod.set(route, latestPostDate || undefined);
      continue;
    }
    const sources = sourcesFor(route);
    lastmod.set(route, sources ? dateForSources(sources) : undefined);
  }
  return lastmod;
}

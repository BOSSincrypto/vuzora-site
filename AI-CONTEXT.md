# Vuzora context for AI agents

## Purpose and honest boundary

Vuzora is a Russian-language static marketing and discovery site for an
unofficial Telegram bot, `@vuzora_bot`, that delivers available university
schedule information in a chosen morning slot. The site provides product
explanation, pricing, legal pages, a university directory, and editorial
content.

This repository does not contain the Telegram bot, schedule parsers, schedule
database, user accounts, authentication, or a public HTTP API. Vuzora is not
official university software and must not speak on behalf of a university.
The site does not publish invented class tables or promise that its messages
replace official university sources. Changes, rooms, documents, and other
official information must be checked with the university.

## Architecture and data flow

1. Hand-edited content lives in `src/content/`. The university registry in
   `src/content/universities.ts` and posts in `src/content/blog.ts` are the
   sources for their public collections.
2. TanStack Start file-based routes in `src/routes/` render React UI and
   route-local metadata. Shared UI is in `src/components/`; shared styles are
   in `src/styles.css`.
3. `src/content/public-routes.ts` derives the explicit prerender seed list.
   `vite.config.ts` enables static prerendering with link crawling disabled and
   errors treated as build failures.
4. `bun run build` runs `vite build`, then `scripts/prepare-release.mjs`.
   The result is a static `dist/` tree. There is no Nitro runtime in the
   Pages release.
5. The release scripts validate that registry data, route artifacts, metadata,
   discovery files, and generated feeds agree before `dist/` is uploaded.
6. GitHub Pages serves the uploaded `dist/` tree at `https://vuzora.ru`.

`src/server.ts` and `src/start.ts` provide server-entry error handling and
response middleware for the TanStack toolchain. They do not mean that a
production application server or Cloudflare Worker is deployed by this
repository.

## Source-tree map

| Path                            | Responsibility                                                         |
| ------------------------------- | ---------------------------------------------------------------------- |
| `src/content/site.ts`           | Brand, canonical origin, legal identity, Telegram destinations         |
| `src/content/universities.ts`   | Authoritative university registry, detail copy, FAQs, slugs, CTAs      |
| `src/content/blog.ts`           | Hand-authored posts, dates, summaries, body paragraphs, slugs          |
| `src/content/faq.ts`            | Landing FAQ source for native controls and JSON-LD                     |
| `src/content/public-routes.ts`  | Core, blog, and university prerender route list                        |
| `src/content/seo.ts`            | Shared indexability, RSS/LLMS discovery, and api-catalog links         |
| `src/routes/`                   | TanStack Start route components, metadata, JSON-LD, sitemap            |
| `src/components/vuzora/`        | Vuzora page sections and shared navigation/footer/CTA UI               |
| `src/lib/webmcp.ts`             | Feature-detected, browser-local read-only WebMCP tools                 |
| `src/server.ts`, `src/start.ts` | Toolchain server entry and middleware boundaries                       |
| `scripts/`                      | Release preparation, validation, feed generation, and regression tests |
| `public/`                       | Checked-in static source artifacts and public discovery files          |
| `vite.config.ts`                | Static prerender and `dist/` build configuration                       |
| `routeTree.gen.ts`              | TanStack-generated route tree. Do not edit by hand                     |
| `dist/`                         | Disposable generated release output. Never use as a source of truth    |

## Routes and content model

Current application routes are:

- `/` landing page
- `/pricing/`
- `/unis/`
- `/unis/<slug>/` university detail pages
- `/blog/` blog index
- `/blog/<slug>/` blog posts
- `/changelog/`
- `/legal/terms/`
- `/legal/privacy/`

Every public page path ends in a trailing slash. GitHub Pages serves each
prerendered route from `<route>/index.html`, so the slashless form only issues
a 301 to the slashed one — a canonical, sitemap entry, or feed permalink
without the slash points at a redirect. Real file paths (`/llms.txt`,
`/sitemap.xml`, `/blog/rss.xml`, `/unis.md`, `/auth.md`) have no slash. The
router is configured with `trailingSlash: "always"` so `<Link>` renders the
canonical form; note that `to` props still use the route id, which the
generated union spells with the slash.

The registry currently contains 25 universities. Each record has a stable
lowercase slug, code, display name, city, status, an optional official URL, and
an optional `scheduleUrl` — the university's own timetable page. `scheduleUrl`
follows the same verify-or-omit rule as `officialUrl`: every address is opened
and confirmed to be a schedule page before it lands in the registry, and a
login-only student portal does not qualify. It is currently set for 15 of 25;
the omissions carry a comment naming the reason — most often that the
university publishes schedules per faculty with no central page. The release validator fails if
a registry-verified external URL is not rendered exactly once on its detail
page, or if any other external destination appears there.
The detail route, sitemap, release manifest, `unis.md`, and WebMCP all derive
from this registry. Slugs are public identifiers and must not be renamed
casually.

Blog posts are plain paragraph arrays in `POSTS`. The index, detail route, RSS
feed, sitemap, and release checks derive from the post records. Blog detail
URLs carry a trailing slash, like every other public page path.

Other public discovery and artifact routes include:

- `/sitemap.xml`
- `/blog/rss.xml`
- `/llms.txt`
- `/auth.md`
- `/unis.md`
- `/.well-known/api-catalog`
- `/.well-known/agent-skills/index.json`
- `/.well-known/agent-skills/public-site-discovery/SKILL.md`

## Generated and public artifacts

Checked-in files under `public/` include `CNAME`, `robots.txt`, `.nojekyll`,
`404.html`, `favicon.svg`, `site.webmanifest`, `auth.md`, `unis.md`, and the
agent discovery files. `public/blog/rss.xml` and `public/llms.txt` are
regenerated from source content by `scripts/generate-rss.mjs` and
`scripts/generate-llms.mjs`.

The build creates route HTML and assets in `dist/`. `prepare-release.mjs`
regenerates RSS and `llms.txt`, copies the explicit Markdown and API catalog
artifacts, writes `release-manifest.json`, and replaces the sitemap with the
authoritative registry-derived route set. `finalize:release` removes the
internal release manifest before upload. Do not hand-edit generated `dist/`
files or treat them as durable source.

## Telegram CTA attribution

Generic conversion links use:

`https://t.me/vuzora_bot?start=from-site`

University detail links use:

`https://t.me/vuzora_bot?start=from-site_<slug>`

The `start` value is attribution and route context, not authentication or proof
of university affiliation. Use helpers from `src/content/universities.ts` and
`src/content/site.ts` instead of assembling destinations inconsistently. The
support bot is `@vuzora_support_bot`. No third-party analytics collector is
part of the current CTA model.

## SEO, AEO, and structured-data rules

- Keep canonical URLs on `https://vuzora.ru` with the trailing slash on page
  paths, and author route metadata in the route or shared SEO content modules.
  A canonical that omits the slash advertises a URL that 301-redirects.
- University detail titles lead with «Расписание» and use the declined
  (genitive) name, because «Расписание <именительный падеж>» is ungrammatical
  Russian. When no name-bearing template fits the 70-character budget the title
  falls back to «Расписание <код>» rather than dropping the keyword. The
  preference order is enforced in `scripts/universities.test.mjs`, which
  re-derives the candidates; the rendered-HTML gate only checks that the title
  identifies the university and keeps the keyword.
- Keep primary CTA links and meaningful answers in server-rendered initial HTML,
  not only behind client JavaScript.
- The landing and university detail FAQ data powers both native
  `<details>/<summary>` controls and `FAQPage` JSON-LD. Keep the two surfaces
  synchronized.
- Preserve route-appropriate JSON-LD identities: the root Organization and
  WebSite graph, `SoftwareApplication` and `FAQPage` on the landing page,
  `Product` on pricing, `ItemList` on the directory, `Blog` and
  `BlogPosting` on blog surfaces, and `CollegeOrUniversity`, `Service`,
  `FAQPage`, and breadcrumbs on university details.
- Keep `sitemap.xml`, RSS, `llms.txt`, and robots rules joined to the same
  registry and route policy. The sitemap is authoritative, not a result of
  accidental crawler discovery.
- Preserve `index, follow` for intended public pages and `noindex` behavior
  for unknown-route recovery. Do not add analytics or tracking claims that are
  not implemented.
- AEO and structured data make public information easier to parse. They do not
  guarantee AI citation, search ranking, inclusion, or answer placement.

## WebMCP and static discovery boundaries

When a browser exposes experimental `document.modelContext`, the site
feature-detects it and registers only two local, read-only tools:
`vuzora.search_universities` and `vuzora.get_university`. They read the bundled
registry and return static identity fields and detail paths. They do not
fetch data, mutate state, expose credentials, or provide schedule rows.

This is browser-local progressive enhancement. It is not a remote MCP server,
MCP Server Card, HTTP API, authentication surface, or agent endpoint. The
static Markdown files are explicit resources, not content negotiation. Do not
invent protocol endpoints, OAuth discovery, response `Link` headers, DNS-AID
records, or `Accept: text/markdown` behavior.

One relation is carried in HTML rather than in a header: every route emits
`<link rel="api-catalog" type="application/linkset+json">` pointing at
`/.well-known/api-catalog` (relation registered by RFC 9727; web linking is
format-agnostic, and GitHub Pages cannot emit response headers). The catalog
itself states that Vuzora implements no HTTP API, so the link advertises the
documented boundary, not an endpoint. `routeMetadataFailures` fails the release
if that link is missing, duplicated, retyped, or points anywhere else. This is
not permission to add a real `Link` response header, an API, or any other
relation from an external readiness checklist.

## Production and Cloudflare boundary

The repository-controlled production path is a static GitHub Pages artifact
deployed from `main`. Cloudflare, DNS, headers, DNSSEC, Workers, and edge
content negotiation are outside this repository and are not implied by
`src/server.ts`. For any proposed edge or DNS work, follow
[`AGENT-DISCOVERY-EDGE-RUNBOOK.md`](AGENT-DISCOVERY-EDGE-RUNBOOK.md). Never add
credentials, private endpoints, or placeholder production targets to this
repository.

## Current release posture

The repository pins Bun `1.3.14`. GitHub Actions installs frozen
dependencies, runs typecheck, lint, tests, build, release validation, browser
regressions against a static server on port `3100`, two clean release cycles,
and finalization before uploading `dist/` to GitHub Pages. Deployment runs on
push to `main`, daily at `03:15 UTC`, or manual dispatch. Release gates are
fail-closed.

## Constraints future agents must not invent

- Do not invent a university, schedule, status, official URL, affiliation,
  classroom detail, parser, API, account system, or backend behavior.
- Verify an official university URL before adding it. Omit it when uncertain.
- Never invent schedules or imply that Vuzora is official university software.
- Do not rename public slugs casually or add routes without updating the
  explicit route policy and release expectations.
- Do not edit `routeTree.gen.ts` or generated `dist/` output by hand.
- Do not claim AI citation or ranking guarantees.
- Do not simulate Cloudflare or edge capabilities in static files.
- Do not commit secrets, tokens, credentials, private endpoints, or telemetry
  that is not part of the implemented product.
- There is no component library. Every UI element is hand-written under
  `src/components/vuzora/`. A scaffolded `src/components/ui/` tree of 46 unused
  primitives was removed along with 45 runtime dependencies; Tailwind's
  `@source "../src"` scan had been emitting their classes into the shipped
  stylesheet. Add a dependency only when something rendered actually imports it.
- There is no client data-fetching library. Route loaders are synchronous
  registry lookups over bundled content; TanStack Query was scaffold residue
  with zero queries and was removed. Do not reintroduce a query client until a
  rendered surface actually fetches data.
- The build depends on no vendor toolchain and no package registry other than
  `registry.npmjs.org`; `scripts/release.test.mjs` fails the release if either
  changes.

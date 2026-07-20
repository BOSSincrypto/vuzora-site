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
| `src/content/seo.ts`            | Shared indexability and RSS/LLMS discovery links                       |
| `src/routes/`                   | TanStack Start route components, metadata, JSON-LD, sitemap            |
| `src/components/vuzora/`        | Vuzora page sections and shared navigation/footer/CTA UI               |
| `src/components/ui/`            | Reusable UI primitives                                                 |
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
- `/pricing`
- `/unis`
- `/unis/<slug>` university detail pages
- `/blog/` blog index
- `/blog/<slug>` blog posts
- `/changelog`
- `/legal/terms`
- `/legal/privacy`

The registry currently contains 25 universities. Each record has a stable
lowercase slug, code, display name, city, status, and an optional official URL.
The detail route, sitemap, release manifest, `unis.md`, and WebMCP all derive
from this registry. Slugs are public identifiers and must not be renamed
casually.

Blog posts are plain paragraph arrays in `POSTS`. The index, detail route, RSS
feed, sitemap, and release checks derive from the post records. Blog detail
URLs are slashless; the only published blog index URL is `/blog/`.

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

- Keep canonical URLs on `https://vuzora.ru`, with route metadata authored in
  the route or shared SEO content modules.
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

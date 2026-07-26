# Routes

TanStack Start uses **file-based routing**. Every `.tsx` file in this directory
defines a route. Do **not** create `src/pages/`, `src/routes/_app/index.tsx`, or
`app/layout.tsx` – those are Next.js / Remix conventions. The only root layout
is `src/routes/__root.tsx`.

## Conventions

This directory uses **flat dot-separated filenames**, not nested folders.
`legal.terms.tsx` serves `/legal/terms/`; there is no `legal/` directory.

Routes in this repository:

| File                | URL                                                  |
| ------------------- | ---------------------------------------------------- |
| `index.tsx`         | `/`                                                  |
| `pricing.tsx`       | `/pricing/`                                          |
| `unis.tsx`          | `/unis/`                                             |
| `unis_.$slug.tsx`   | `/unis/:slug/` **without** nesting under `unis.tsx`  |
| `blog.index.tsx`    | `/blog/` (index of the `blog` segment)               |
| `blog.$slug.tsx`    | `/blog/:slug/` (dynamic – bare `$`, no curly braces) |
| `changelog.tsx`     | `/changelog/`                                        |
| `legal.terms.tsx`   | `/legal/terms/` (flat dot segment)                   |
| `legal.privacy.tsx` | `/legal/privacy/`                                    |
| `sitemap[.]xml.tsx` | `/sitemap.xml` (`[.]` escapes a literal dot)         |
| `__root.tsx`        | app shell – wraps every page; preserve `<Outlet />`  |

Syntax reference — **examples only, not present in this repo**:

| File                     | URL                                                     |
| ------------------------ | ------------------------------------------------------- |
| `posts/{-$category}.tsx` | `/posts/:category?` (optional segment)                  |
| `files/$.tsx`            | `/files/*` (splat – read via `_splat` param, never `*`) |
| `_layout.tsx`            | layout route (renders children via `<Outlet />`)        |

The trailing underscore matters: `unis.tsx` renders the directory at `/unis`,
and detail pages opt **out** of nesting under it via `unis_.$slug.tsx`. Naming
the file `unis.$slug.tsx` (or `unis/$slug.tsx`) would nest the detail page
inside the directory route and render both layouts.

Public page URLs carry a trailing slash (`/unis/` renders the directory at
`/unis/`). The router sets `trailingSlash: "always"`, so `<Link to>` takes the
value spelled in the generated route union — with the slash — and renders the
canonical href.

`routeTree.gen.ts` is auto-generated. Don't edit it by hand.

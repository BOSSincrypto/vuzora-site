# Vuzora site

Russian SEO-oriented marketing site for [Vuzora](https://vuzora.ru) — a Telegram bot that delivers university schedules. Static marketing pages for the product, university directory, and blog; CTAs open `@vuzora_bot` with start-param attribution.

- Live: https://vuzora.ru
- Repo: https://github.com/BOSSincrypto/vuzora-site

## Stack

- TanStack Start / TanStack Router
- React 19
- Vite
- Bun `1.3.14` (package manager)
- Static export to GitHub Pages (no Nitro runtime)

Canonical domain is `vuzora.ru` (`public/CNAME`).

## Prerequisites

- [Bun](https://bun.sh) **1.3.14** (see `packageManager` in `package.json`)
- Fallback if Bun is not installed: `npx --yes bun@1.3.14`

## Setup

```bash
bun install --frozen-lockfile
```

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Local Vite dev server |
| `bun run typecheck` | TypeScript (`tsc --noEmit`) |
| `bun run lint` | ESLint, zero warnings |
| `bun run test` | Node test runner on `scripts/*.test.mjs` |
| `bun run build` | Production static build + release prepare |
| `bun run validate:release` | Fail-closed release artifact checks |
| `bun run repeat:release` | Two clean frozen-install build cycles |
| `bun run finalize:release` | Strip internal transport manifest from `dist/` |

## Deploy

GitHub Actions (`.github/workflows/deploy.yml`) on push to `main` (also daily cron and `workflow_dispatch`):

1. `bun install --frozen-lockfile`
2. `typecheck` → `lint` → `test` → `build`
3. `validate:release` → `repeat:release` → `finalize:release`
4. Upload `dist/` to GitHub Pages

Custom domain: **vuzora.ru**.

## Routes

| Path | Notes |
| --- | --- |
| `/` | Landing |
| `/unis` | University directory |
| `/unis/<slug>` | University detail pages from the registry in `src/content/universities.ts` (**25** entries) |
| `/blog/`, `/blog/<slug>` | Blog index and posts |
| `/pricing`, `/changelog` | Product pages |
| `/legal/terms`, `/legal/privacy` | Legal |

Also prerendered: `sitemap.xml`, `404.html`.

## Telegram CTAs

Attribution uses Telegram bot start params only (no Plausible or other third-party analytics):

| Context | URL |
| --- | --- |
| Generic | `https://t.me/vuzora_bot?start=from-site` |
| University | `https://t.me/vuzora_bot?start=from-site_<slug>` |

## Quality notes

- Release gates are **fail-closed**: bad artifacts block deploy.
- Primary CTAs stay crawlable in the initial HTML (not JS-only).
- Motion and content respect reduced-motion / data preferences where applicable.
- Official university URLs are listed only when verified; never invent them.
- Service disclaimer: not an official university service.

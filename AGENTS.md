<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Mission and boundaries

Vuzora is a Russian-language static marketing and discovery site for the
unofficial `@vuzora_bot` Telegram schedule-delivery service. It is not
official university software. This repository does not contain the bot,
schedule backend, user accounts, authentication, or a public HTTP API.

Before editing, read [`AI-CONTEXT.md`](AI-CONTEXT.md) and
[`AI-CHANGE-CHECKLIST.md`](AI-CHANGE-CHECKLIST.md), inspect the relevant source
and tests, and check `git status`. Work only in the requested scope. Do not
invent schedules, university affiliations, classroom details, backend
behavior, API endpoints, credentials, or Cloudflare capabilities.

## Coding conventions

- Use the existing TanStack Start file-based routing under `src/routes/`.
- Do not edit generated `src/routeTree.gen.ts` or `dist/` by hand.
- Keep authoritative content in `src/content/` and derive routes, feeds,
  discovery artifacts, and metadata from those sources.
- Preserve server-rendered crawlable HTML, keyboard accessibility, reduced
  motion and data behavior, canonical metadata, and the established concise
  style.
- Keep public slugs stable. Use existing helpers for canonical paths and
  Telegram links rather than duplicating string construction.

## Content truth rules

- Verify official university URLs before adding them. Omit `officialUrl` when
  the URL is uncertain, unstable, or not safely verified.
- Never invent schedules. Do not present Vuzora as a university or imply that
  its messages replace official university sources.
- Preserve the affiliation wording that the service is not an official
  university service on university-facing content.
- Keep CTA attribution exact: generic links use `start=from-site`, and
  university links use `start=from-site_<slug>`.
- Do not claim AI citation, answer placement, or search ranking guarantees.

## Required validation

After every file edit, run the relevant validators. At minimum, before
handoff, run with Bun `1.3.14`:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run test
bun run build
bun run validate:release
```

If Bun is unavailable, use `npx --yes bun@1.3.14` in place of `bun` for these
commands. For release or UI changes, also run the browser regressions against
the static server on port `3100` and complete the two clean release cycles:

```sh
node scripts/static-server.mjs dist
bun run repeat:release
bun run finalize:release
```

Use the exact browser commands and live checks in
[`AI-CHANGE-CHECKLIST.md`](AI-CHANGE-CHECKLIST.md). Do not hand off with a
failing or unexplained validator.

## Release and deployment rules

The production artifact is static GitHub Pages output. `main` deploys through
`.github/workflows/deploy.yml` after frozen install, typecheck, lint, tests,
build, release validation, browser checks, repeat builds, and finalization.
Release validation is fail-closed. Inspect `git diff --check`, the complete
diff, and secret-like patterns before publishing. Keep generated artifacts
consistent with their source generators.

This repository is connected to Lovable. Do not force-push, rebase, amend,
squash, or otherwise rewrite published history. Push only reviewed commits
after the full release gates pass, then verify the changed route and key live
artifacts at `https://vuzora.ru`.

## Cloudflare and edge rule

Repository code controls the static origin and its checked-in artifacts only.
It does not deploy Cloudflare headers, DNS-AID records, DNSSEC, Workers, true
`Accept: text/markdown` negotiation, or a remote MCP service. Do not simulate
these capabilities in source or public files. For a real edge change, follow
[`AGENT-DISCOVERY-EDGE-RUNBOOK.md`](AGENT-DISCOVERY-EDGE-RUNBOOK.md), verify
real production targets, and keep credentials out of the repository.

## When blocked

Stop and report the exact file, command, error, and missing decision. Ask for
owner confirmation when an official URL, product claim, schedule fact,
credential, deployment permission, or Cloudflare setting is uncertain. Never
weaken a validator or fill a gap with a fabricated fact.

Before handing off work, report the files changed, validation commands and
results, any generated artifacts updated, and any remaining blocker. Do not
commit or push unless the parent task explicitly requires it.

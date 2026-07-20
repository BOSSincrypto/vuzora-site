# AI change checklist

Use this checklist for every repository change. Keep the working tree
reviewable and do not force-push.

## 1. Inspect before editing

- Read `AGENTS.md`, `AI-CONTEXT.md`, and the relevant source and tests.
- Check the branch and working tree:

```sh
git status --short --branch
git diff --check
```

- Confirm Bun `1.3.14` is available. Use Bun directly when available:

```sh
bun --version
bun install --frozen-lockfile
```

- If Bun is unavailable, use the pinned fallback for every Bun command:

```sh
npx --yes bun@1.3.14 --version
npx --yes bun@1.3.14 install --frozen-lockfile
```

## 2. Make a content, route, or UI change

- Change the smallest authoritative source. Do not edit `dist/` or
  `routeTree.gen.ts` by hand.
- Preserve Russian copy, crawlable initial HTML, accessibility, canonical
  metadata, and the non-official-service boundary.
- Keep CTA attribution exact:
  `from-site` for generic links and `from-site_<slug>` for university links.
- For route changes, update `src/content/public-routes.ts`, route expectations,
  sitemap or release policy as required, then regenerate generated artifacts.
- Check for accidental secrets or private endpoints before testing:

```sh
git diff --check
git diff -- . ':!bun.lock'
```

## 3. Add a university

- Verify the official university HTTPS URL first. Omit `officialUrl` if it is
  uncertain or unstable.
- Add one stable lowercase slug, code, exact display name, city, and status to
  `src/content/universities.ts`.
- Add any required genitive copy and detail focus without inventing schedules,
  affiliation, classrooms, or official claims.
- Confirm the detail page includes the affiliation boundary and a
  university-attributed Telegram CTA.
- Regenerate and inspect discovery artifacts:

```sh
node scripts/generate-llms.mjs
node scripts/generate-rss.mjs
```

## 4. Add a blog post

- Append a unique URL-safe slug to `src/content/blog.ts`.
- Use a real ISO date, truthful title and summary, reading time, and ordered
  plain-text paragraphs.
- Use the existing `[[/path|label]]` link syntax for internal links.
- Keep university-focused posts joined to a real registry slug and preserve
  the disclaimer where relevant.
- Regenerate RSS and inspect the generated result:

```sh
node scripts/generate-rss.mjs
```

## 5. Change release scripts

- Read the related release tests and `AGENT-DISCOVERY-EDGE-RUNBOOK.md` first.
- Preserve explicit prerender seeds, fail-closed validation, deterministic
  build behavior, and generated artifact joins.
- Do not weaken validators to make a build pass. Do not add credentials or
  edge-only behavior to static release code.
- Run focused tests for the changed script, then the full gates below.

## 6. Run focused checks

Use Bun directly:

```sh
bun run typecheck
bun run lint
bun run test
```

Fallback:

```sh
npx --yes bun@1.3.14 run typecheck
npx --yes bun@1.3.14 run lint
npx --yes bun@1.3.14 run test
```

For a built static tree, run the release validator and serve `dist/` on the
required local port:

```sh
bun run build
bun run validate:release
node scripts/static-server.mjs dist
```

In another shell:

```sh
curl --fail --silent http://127.0.0.1:3100/ >/dev/null
curl --fail --silent http://127.0.0.1:3100/sitemap.xml >/dev/null
curl --fail --silent http://127.0.0.1:3100/llms.txt >/dev/null
```

Run browser regressions against that server when the UI, metadata, or WebMCP
surface changes. Install the pinned browser tool if needed:

```sh
npm install --global agent-browser@0.32.3
agent-browser install
VUZORA_ORIGIN=http://127.0.0.1:3100 bun run test:browser:mobile-menu
VUZORA_ORIGIN=http://127.0.0.1:3100 bun run test:browser:unknown-route-metadata
VUZORA_ORIGIN=http://127.0.0.1:3100 bun run test:browser:blog-metadata
VUZORA_ORIGIN=http://127.0.0.1:3100 bun run test:browser:webmcp
```

Use `npx --yes bun@1.3.14 run ...` instead of each `bun run ...` command when
Bun is unavailable.

## 7. Run the full release gates

Before handoff or publishing, run:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run test
bun run build
bun run validate:release
bun run repeat:release
bun run finalize:release
test ! -e dist/release-manifest.json
test -s dist/index.html
test -s dist/404.html
test -s dist/sitemap.xml
```

Use the pinned `npx --yes bun@1.3.14` fallback for the Bun commands if needed.
Run browser regressions against `http://127.0.0.1:3100` before finalizing when
the deployment workflow would run them.

## 8. Check git safety

- Inspect all changes, including generated public files:

```sh
git status --short
git diff --stat
git diff --check
git diff
```

- Search the diff for likely secrets and private infrastructure. The release
  tests also enforce secret and unsupported-discovery boundaries:

```sh
git diff --no-ext-diff | grep -Ein \
  'token|secret|password|api[_-]?key|private[_-]?key|BEGIN [A-Z ]+PRIVATE KEY|sk_live|ghp_'
```

Treat any match as a stop-and-review event. Never include credentials,
cookies, private URLs, or temporary tokens in files or logs.

## 9. Publish and verify live

- Confirm the intended branch, review the complete diff, and make a focused
  commit. Never use `git push --force`, `--force-with-lease`, rebase, amend,
  or squash published history in this Lovable-connected repository.
- Push normally only after all gates pass:

```sh
git status --short --branch
git add <reviewed-files>
git commit -m "Describe the reviewed change"
git push origin main
```

- GitHub Actions runs the same release gates, serves the resulting `dist/`,
  and deploys GitHub Pages. After deployment, verify the live canonical site:

```sh
curl --fail --silent --show-error https://vuzora.ru/ >/dev/null
curl --fail --silent --show-error https://vuzora.ru/sitemap.xml >/dev/null
curl --fail --silent --show-error https://vuzora.ru/blog/rss.xml >/dev/null
curl --fail --silent --show-error https://vuzora.ru/llms.txt >/dev/null
curl --fail --silent --show-error https://vuzora.ru/unis.md >/dev/null
```

- Spot-check the changed route, its canonical metadata, visible CTA, and
  internal links in a browser. Cloudflare headers, DNS, Workers, and edge
  negotiation are separate operator-controlled concerns. Use
  `AGENT-DISCOVERY-EDGE-RUNBOOK.md` rather than claiming they were deployed.

## When blocked

Stop rather than inventing data or weakening a gate. Report the exact file,
command, error, and missing decision. Ask the owner to resolve uncertain
official URLs, product behavior, credentials, Cloudflare configuration, or
release ownership before continuing.

# Agent Discovery Edge Runbook

This is a manual runbook for Cloudflare, DNS, and edge capabilities that a
static GitHub Pages artifact cannot emit. It is operational guidance, not a
claim that any edge change has been made. No Cloudflare credentials, DNS
agent endpoint, or edge worker is available in this repository.

## 0. Safety and release boundary

Before changing production:

1. Confirm that the target resource or service has a real HTTPS endpoint,
   owner, TLS certificate, protocol contract, and rollback plan.
2. Confirm that every URL used in a header, DNS record, or edge mapping
   returns the intended public resource. Never use a placeholder hostname.
3. Keep the static origin behavior unchanged for ordinary browsers.
4. Do not put Cloudflare tokens, DNS API keys, registrar credentials, or
   private endpoints in this repository, its build output, or command logs.

The following are **not deployed or simulated by this static repository**:

- HTTP `Link` response headers.
- DNS-AID SVCB/HTTPS records or DNSSEC proofs.
- True `Accept: text/markdown` content negotiation on extensionless routes.

`edge/markdown-negotiation.mjs` is the reviewed source for the first and
third items. It is a Cloudflare Snippet/Worker module held in this repository
and covered by `scripts/markdown-negotiation.test.mjs`. GitHub Pages cannot
execute it, so it changes nothing in production until an operator installs it
under section 3.1 — one deployment carries both capabilities, and the `Link`
fields reach exactly the routes listed in `wrangler.toml`.

The checked-in Markdown files (`/auth.md`, `/unis.md`, and the published
Agent Skills file) are explicit static resources only. They do not provide
header negotiation. The static API catalog declares that no HTTP API exists.
Browser-local read-only WebMCP, when a browser exposes it, is not a remote
agent endpoint.

## 1. HTTP `Link` response headers

### 1.1 Select only real targets and registered relations

The current static release has these public targets:

| Relation | Target | Registration and meaning |
| --- | --- | --- |
| `api-catalog` | `/.well-known/api-catalog` | Registered by RFC 9727. The current catalog truthfully says that Vuzora has no HTTP API. |
| `service-doc` | `/auth.md` | Registered by RFC 8631. This target documents the no-auth boundary; it is not an OAuth or API endpoint. |
| `describedby` | `/llms.txt` | Registered in the IANA Link Relation registry. This target describes the public site for crawlers. |

Use the IANA registry and RFC 8288 serialization rules when adding a
relation. Do not invent a relation token when a registered type exists. Do
not advertise `service-desc` until a real machine-readable service
description exists. In particular, do not use a Link header to advertise
OAuth/OIDC discovery, a protected resource, a remote MCP Server Card, or a
fictional API.

### 1.2 Configure the edge rule

`edge/markdown-negotiation.mjs` appends these fields to every response it
returns, so deploying that Worker under section 3.1 covers this section too —
there is nothing separate to configure, and `DISCOVERY_LINK_HEADERS` in that
module is the single place the fields are written:

```http
Link: </.well-known/api-catalog>; rel="api-catalog"
Link: </auth.md>; rel="service-doc"
Link: </llms.txt>; rel="describedby"
```

`scripts/markdown-negotiation.test.mjs` fails if a relation outside the
registered set appears or if a target stops being published, but a passing
test only proves the file exists — verify the served identity under 1.3.

An HTTP response header Transform Rule is the alternative when the Worker is
not deployed. Deploy one, not both, or the fields arrive twice. A rule must:

1. Match only the intended host and response paths, starting with `/`.
2. Preserve the origin status, body, content type, and existing headers.
3. Append the fields above only after each target has been verified as public
   and intentional.

Multiple `Link` fields are valid. A comma-separated field is also valid, but
each target and relation must retain its own parameters. Use quoted relation
parameters and angle brackets around URI references as shown.

Note that the Worker's routes stop at the public sections, so the fields do
not appear on assets or on the discovery targets themselves. The homepage,
which is what an external readiness scanner reads, is covered.

### 1.3 Verify after deployment

Run these commands from a machine that can reach the production hostname:

```sh
set -eu
ORIGIN='https://vuzora.ru'
curl -fsSL -D /tmp/vuzora-link-home.headers -o /tmp/vuzora-link-home.body "$ORIGIN/"
grep -iE '^link:.*rel="(api-catalog|service-doc|describedby)"' \
  /tmp/vuzora-link-home.headers
for path in \
  '/.well-known/api-catalog' \
  '/auth.md' \
  '/llms.txt'
do
  curl -fsSL -D "/tmp/vuzora-link-${path##*/}.headers" \
    -o "/tmp/vuzora-link-${path##*/}.body" "$ORIGIN$path"
done
```

Confirm manually that each response is `200`, has the expected media type,
and contains the expected identity. A successful header grep alone is not
proof that the targets are valid.

Until the edge is deployed, this check must find nothing — a `Link` header
before deployment means the static origin is faking one:

```sh
if curl -fsSL -D - -o /dev/null https://vuzora.ru/ |
  grep -qi '^link:'; then
  echo 'Unexpected static Link header; investigate before proceeding'
  exit 1
fi
```

After deployment it is expected to find the three fields and nothing else.
The static artifact still emits no header of its own; a local build served on
the mission's port-3100 server is where that stays checkable.

An external scanner reports the same capability. Treat it as a second
opinion, not as the evidence:

```sh
curl -fsS -X POST https://isitagentready.com/api/scan \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://vuzora.ru"}' |
  jq -e '.checks.discoverability.linkHeaders.status == "pass"'
```

References:

- https://www.rfc-editor.org/rfc/rfc8288
- https://www.rfc-editor.org/rfc/rfc8631
- https://www.rfc-editor.org/rfc/rfc9727#section-3
- https://www.iana.org/assignments/link-relations/

## 2. DNS-AID SVCB/HTTPS records and DNSSEC

DNS-AID is an Internet-Draft, not a deployed Vuzora capability. Follow the
latest draft before publishing a record because names and parameters may
change. A record is safe to publish only when a real agent service exists
and its protocol, TLS, authentication, and ownership have been reviewed.

### 2.1 Select the draft, owner, and real endpoint first

Do not choose a DNS owner name from this runbook. Before writing any record,
document the exact DNS-AID draft and version, the relevant section, the
agent protocol, and the real HTTPS endpoint. The current referenced draft
distinguishes an agent-specific primary owner from an organization index:
`<agent-owner-fqdn>` is a placeholder for the reviewed owner of one agent,
whereas `_index._agents.<domain>` is the separate organization-level index.
The index name is not a substitute for an agent owner, and an
agent-specific owner is not an organization index. `_a2a._agents` is not a
universal owner name; use it only if the exact selected draft and reviewed
deployment require that name for a specific purpose.

The DNS target must be the hostname of the deployed agent service, not
`vuzora.ru`, GitHub Pages, Telegram, a browser-local WebMCP tool, an OAuth
issuer, or a remote MCP placeholder. Do not paste the following notation
literally. Replace every angle-bracket value with reviewed production data
only after the draft, version, owner role, endpoint, certificate, protocol,
and rollback plan have been approved. Otherwise, do not create the record:

```dns
<agent-owner-fqdn>. 3600 IN SVCB 1 <real-agent-target>. alpn="<reviewed-alpn>" port=<reviewed-port>
```

If the selected draft also requires organization-level discovery, review and
configure `_index._agents.<domain>` as that separate index owner. Do not
turn the index into an agent-specific record or assume that an `a2a` label is
the owner:

```dns
_index._agents.<domain>. 3600 IN <draft-selected-record-type> 1 <real-index-target>. alpn="<reviewed-alpn>" port=<reviewed-port>
```

Use an `HTTPS` record only when the selected DNS-AID draft and the actual
agent protocol require it. If required, use the same reviewed owner role,
target, and parameters, never a fictional service:

```dns
<agent-owner-fqdn>. 3600 IN HTTPS 1 <real-agent-target>. alpn="<reviewed-alpn>" port=<reviewed-port>
```

Do not publish both record types merely to make discovery appear complete.
The selected draft, endpoint protocol, certificate, and client behavior must
justify the record type and every SvcParamKey. Avoid `mandatory` parameters
unless the endpoint and clients actually support all of them.

### 2.2 Configure Cloudflare DNS and the registrar

1. Confirm the exact DNS-AID draft/version and section, then select the
   reviewed agent-specific owner for the real target. If organization
   discovery is required, treat `_index._agents.<domain>` as a separate
   index owner.
2. In the authoritative Cloudflare zone, create only the draft-required
   SVCB or HTTPS record for that reviewed owner and real target. Never assume
   `_a2a._agents` is the owner.
3. Confirm the target presents the expected certificate and advertises the
   expected ALPN and port. Do not proxy or rewrite the endpoint unless its
   protocol supports that path.
4. In Cloudflare DNSSEC, enable signing for `vuzora.ru` and record the
   generated DS parameters.
5. At the registrar, publish that DS record without changing its digest,
   algorithm, or key-tag values.
6. Wait for parent-zone propagation and validate from an independent
   validating resolver.

DNSSEC authenticates DNS answers. It does not make a nonexistent agent
endpoint real, authenticate an application session, or create an HTTP API.

### 2.3 Verify SVCB/HTTPS answers and DNSSEC

These commands are read-only and are evidence only after an operator has
actually deployed the records:

```sh
set -eu
AGENT_OWNER='<reviewed-agent-owner-fqdn>'
INDEX_OWNER='_index._agents.<domain>'
dig +dnssec +adflag +multi "$AGENT_OWNER" SVCB
dig +dnssec +adflag +multi "$AGENT_OWNER" HTTPS
# Run the index-owner checks only when the selected draft requires an index.
dig +dnssec +adflag +multi "$INDEX_OWNER" SVCB
dig +dnssec +adflag +multi "$INDEX_OWNER" HTTPS
dig +dnssec +adflag +multi vuzora.ru DNSKEY
dig +dnssec +adflag +multi vuzora.ru DS
```

Do not run these commands with literal placeholders. Check for the exact
owner selected from the reviewed draft, the record type, target, SvcParamKey
values, `RRSIG` coverage, and the validating resolver's `ad` flag. An empty
answer or an answer without authenticated DNSSEC data is not a pass.

Use DNS-over-HTTPS as an independent read-only check. The `AD` value must be
true when the resolver has authenticated the answer:

```sh
set -eu
curl -fsS \
  -H 'accept: application/dns-json' \
  --get --data-urlencode "name=$AGENT_OWNER" --data-urlencode 'type=SVCB' \
  'https://cloudflare-dns.com/dns-query' \
  -o /tmp/vuzora-dnsaid.json
jq -e '.Status == 0 and .AD == true and (.Answer | length) > 0' \
  /tmp/vuzora-dnsaid.json
```

Repeat with `type=HTTPS` and, when required by the selected draft, with
`name=$INDEX_OWNER`. If the endpoint is not deployed, do not treat a
successful DoH request for a missing record as evidence of DNS-AID
deployment.

References:

- https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/
- https://www.rfc-editor.org/rfc/rfc9460
- https://www.cloudflare.com/dns/dnssec/

## 3. True `Accept: text/markdown` negotiation

### 3.1 Configure an edge implementation

GitHub Pages serves the committed static files and cannot select a
representation from `Accept` on its own. Two implementations are available.
Deploy one, not both.

**Option A — the repository's Worker (recommended).** Every public page
already ships a curated Markdown mirror at the path agents probe, so the
edge only has to route: `/unis/msu/` answers with `/unis/msu.md`, which is
generated from the same content the HTML renders and validated by the
release. `edge/markdown-negotiation.mjs` is the code and `wrangler.toml` is
its deployment, both held here and deployed by the zone operator:

```sh
npx --yes wrangler@4 login    # opens a browser; authorizes this machine only
npx --yes wrangler@4 deploy   # publishes the Worker and its routes
```

Then confirm the failure mode. In **Workers & Pages → the Worker → Settings
→ Domains & Routes**, each route should be set to **Fail open**, so a Worker
that cannot run — including a free plan past its 100,000 requests for the
day — leaves the request to the origin and the site keeps serving HTML.

The routes in `wrangler.toml` cover the public sections rather than
`vuzora.ru/*`, so assets do not spend the daily request budget on a
pass-through. A new top-level section needs a new route; the release test
`scripts/markdown-negotiation.test.mjs` fails when a published page falls
outside every pattern.

Cloudflare Snippets run the same module from **Rules → Snippets** with the
expression `http.host eq "vuzora.ru"`, and are the simpler path on a zone
whose plan includes them. They are not available on the free plan.

**Option B — Cloudflare Markdown for Agents.** Cloudflare converts the
origin HTML at the edge instead. It needs no repository code but is a paid
zone feature (Pro or Business), and it converts the rendered page —
navigation and footer included — rather than serving the curated mirror.
Enable it in **AI Crawl Control**, or set the zone setting directly, and
confirm the plan supports it first:

```sh
curl -fsS -X PATCH \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/content_converter" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"value":"on"}'
```

Keep the token out of shell history, this repository, and command logs.

Either implementation must satisfy the following, and section 3.2 checks all
of them:

1. Keep the default request, including no `Accept` header or ordinary
   `Accept: text/html`, as the existing HTML representation.
2. For an acceptable `text/markdown` media range, use Cloudflare's edge
   conversion or map to a real, reviewed Markdown representation for that
   exact route.
3. Respect quality values. `text/markdown;q=0` must not select Markdown.
4. Return `Content-Type: text/markdown; charset=utf-8` for the Markdown
   representation.
5. Return `Vary: Accept` and include `Accept` in the cache key so Markdown
   cannot be served to an HTML request.
6. Add `x-markdown-tokens` only when the edge actually calculates the
   response's token count. It is not a static-site claim, and Option A does
   not emit it.
7. Keep redirects, status codes, access policy, and ordinary navigation
   unchanged. A route with no mirror must still answer with its HTML page.

Do not create a catch-all extensionless `.md` route. The repository's
explicit `/auth.md` and `/unis.md` files remain direct static fallbacks.
They do not prove that `/unis/msu/` negotiates Markdown.

### 3.2 Verify both representations

Use a trailing slash or follow the site's canonical redirect. The `-L`
flag prevents a redirect response from being mistaken for the negotiated
representation:

```sh
set -eu
ORIGIN='https://vuzora.ru'
ROUTE='/unis/msu/'
curl -fsSL -D /tmp/vuzora-html.headers -o /tmp/vuzora-html.body \
  "$ORIGIN$ROUTE"
curl -fsSL -D /tmp/vuzora-markdown.headers \
  -H 'Accept: text/markdown' \
  -o /tmp/vuzora-markdown.body \
  "$ORIGIN$ROUTE"

grep -iE '^content-type: text/html([;[:space:]]|$)' \
  /tmp/vuzora-html.headers
grep -iE '^content-type: text/markdown([;[:space:]]|$)' \
  /tmp/vuzora-markdown.headers
grep -iE '^vary:.*(^|[,[:space:]])accept([,;[:space:]]|$)' \
  /tmp/vuzora-markdown.headers
if grep -Eiq '<!doctype[[:space:]]+html|<html[ >]' \
  /tmp/vuzora-markdown.body; then
  echo 'Markdown response contains an HTML document'
  exit 1
fi
wc -c /tmp/vuzora-html.body /tmp/vuzora-markdown.body
```

Also check a normal browser preference and an explicit refusal:

```sh
curl -fsSL -D /tmp/vuzora-browser.headers -o /tmp/vuzora-browser.body \
  -H 'Accept: text/html' "$ORIGIN$ROUTE"
curl -fsSL -D /tmp/vuzora-refused.headers -o /tmp/vuzora-refused.body \
  -H 'Accept: text/markdown;q=0, text/html;q=1' "$ORIGIN$ROUTE"
grep -iE '^content-type: text/html([;[:space:]]|$)' \
  /tmp/vuzora-browser.headers /tmp/vuzora-refused.headers
```

Verify the repository's explicit static fallbacks separately:

```sh
for path in /auth.md /unis.md; do
  curl -fsSL -D /tmp/vuzora-static-${path##*/}.headers \
    -o /tmp/vuzora-static-${path##*/}.body "https://vuzora.ru$path"
  grep -iE '^content-type: text/markdown([;[:space:]]|$)' \
    /tmp/vuzora-static-${path##*/}.headers
done
```

Before deployment, a local static check must show the repository's normal
HTML route and explicit files only. It must not be reported as evidence of
edge negotiation. Use the mission's port-3100 server and compare its
`Accept: text/markdown` response with the normal HTML response.

An external scanner reports the same capability. Treat it as a second
opinion, not as the evidence — the curl checks above are the evidence:

```sh
curl -fsS -X POST https://isitagentready.com/api/scan \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://vuzora.ru"}' |
  jq -e '.checks.contentAccessibility.markdownNegotiation.status == "pass"'
```

References:

- https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/
- https://developers.cloudflare.com/rules/snippets/
- https://isitagentready.com/.well-known/agent-skills/markdown-negotiation/SKILL.md

## 4. A2A Agent Card and the JSON-RPC interface

Unlike every other artifact in this runbook, the Agent Card at
`/.well-known/agent-card.json` describes an *agent*, not a document. Its
`supportedInterfaces[0].url` is `https://vuzora.ru/a2a/v1`, and the origin has
nothing at that path: GitHub Pages serves committed files and cannot answer a
POST. The endpoint is `edge/a2a-agent.mjs`, reached through `edge/worker.mjs`
on the `vuzora.ru/a2a/*` route in `wrangler.toml`.

### 4.1 Deployment order is not optional

The card is a static artifact and ships with the GitHub Pages release; the
endpoint ships with `wrangler deploy`. Publishing the card first advertises a
URL that answers `404`, which is exactly the fabricated capability section 0
forbids. Deploy the Worker **before** merging the card to `main`:

```sh
bun run test
npx --yes wrangler@latest deploy
```

`wrangler deploy` publishes `edge/worker.mjs` and its imports, and nothing
else. The site remains the static GitHub Pages artifact.

### 4.2 What the endpoint is allowed to be

The endpoint implements `SendMessage` and nothing else. It creates no task,
holds no state, requires no authentication, and answers
`UnsupportedOperationError` for every other operation the specification
defines. Every reply is read back out of an artifact the release already
publishes — `/unis.md` and the Markdown mirrors — so the agent cannot say
anything the site does not already say in public. `scripts/agent-card.mjs`
fails the release if the card claims streaming, push notifications, an
extended card, a security scheme, an interface other than the deployed one,
or a target file the release does not publish.

Do not add a skill to the card before the endpoint implements it. The card
and `edge/a2a-agent.mjs` are pinned together by `scripts/agent-card.test.mjs`.

### 4.3 Verify after deployment

These commands are evidence only once the Worker is live:

```sh
set -eu
curl -fsS https://vuzora.ru/.well-known/agent-card.json |
  jq -e '.supportedInterfaces[0].protocolBinding == "JSONRPC"'

curl -fsS -X POST https://vuzora.ru/a2a/v1 \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"SendMessage","params":{"message":{"messageId":"probe","role":"ROLE_USER","parts":[{"text":"МГУ"}]}}}' |
  jq -e '.result.message.role == "ROLE_AGENT"'

# Operations the card declares unsupported must fail as unsupported, not 404.
curl -fsS -X POST https://vuzora.ru/a2a/v1 \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":2,"method":"SendStreamingMessage","params":{}}' |
  jq -e '.error.code == -32004'
```

An external scanner reports the same capability. Treat it as a second
opinion, not as the evidence:

```sh
curl -fsS -X POST https://isitagentready.com/api/scan \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://vuzora.ru"}' |
  jq -e '.checks.discovery.a2aAgentCard.status == "pass"'
```

References:

- https://a2a-protocol.org/latest/specification/
- https://a2a-protocol.org/latest/topics/agent-discovery/
- https://www.rfc-editor.org/rfc/rfc8615

## 5. Final negative checks and ownership record

Record the date, zone, edge product or Worker version, DNS change ID, and
the exact commands above in the operator's deployment system. Do not record
credentials.

If the checks cannot be run because there is no real endpoint, Cloudflare
access, or registrar access, record **not deployed and not validated here**.
That is the expected state for this repository.

The static release must continue to show:

- no HTTP API implementation;
- no OAuth/OIDC issuer, token endpoint, or protected-resource metadata;
- no remote MCP server, transport endpoint, or Server Card;
- no fabricated Link, DNS-AID, DNSSEC, or extensionless Markdown behavior.

References for the boundary documents:

- `/.well-known/api-catalog`
- `/auth.md`
- https://www.rfc-editor.org/rfc/rfc8288
- https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/
- https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/

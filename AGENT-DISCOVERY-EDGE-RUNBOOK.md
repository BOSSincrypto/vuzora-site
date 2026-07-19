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

In Cloudflare, use an HTTP response header Transform Rule or a Worker owned
by the production operator:

1. Match only the intended host and response paths, starting with `/`.
2. Preserve the origin status, body, content type, and existing headers.
3. Append the following only after each target has been verified as public
   and intentional:

```http
Link: </.well-known/api-catalog>; rel="api-catalog"
Link: </auth.md>; rel="service-doc"
Link: </llms.txt>; rel="describedby"
```

Multiple `Link` fields are valid. A comma-separated field is also valid, but
each target and relation must retain its own parameters. Use quoted relation
parameters and angle brackets around URI references as shown.

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

Before edge deployment, the repository-controlled negative check should show
that no `Link` header is being faked by the static origin:

```sh
if curl -fsSL -D - -o /dev/null https://vuzora.ru/ |
  grep -qi '^link:'; then
  echo 'Unexpected static Link header; investigate before proceeding'
  exit 1
fi
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

### 2.1 Prepare the real endpoint first

The DNS target must be the hostname of the deployed agent service, not
`vuzora.ru`, GitHub Pages, Telegram, a browser-local WebMCP tool, an OAuth
issuer, or a remote MCP placeholder. Do not paste the following notation
literally. Replace every angle-bracket value with reviewed production data,
or do not create the record:

```dns
_a2a._agents.<zone>. 3600 IN SVCB 1 <real-agent-target>. alpn="a2a" port=443
```

Use an `HTTPS` record only when the selected DNS-AID draft and the actual
agent protocol require it. If required, use the same reviewed target and
parameters, never a fictional service:

```dns
_a2a._agents.<zone>. 3600 IN HTTPS 1 <real-agent-target>. alpn="a2a" port=443
```

Do not publish both record types merely to make discovery appear complete.
The selected draft, endpoint protocol, certificate, and client behavior must
justify the record type and every SvcParamKey. Avoid `mandatory` parameters
unless the endpoint and clients actually support all of them.

### 2.2 Configure Cloudflare DNS and the registrar

1. In the authoritative Cloudflare zone, create the draft-required
   `_a2a._agents` SVCB or HTTPS record for the real target.
2. Confirm the target presents the expected certificate and advertises the
   expected ALPN and port. Do not proxy or rewrite the endpoint unless its
   protocol supports that path.
3. In Cloudflare DNSSEC, enable signing for `vuzora.ru` and record the
   generated DS parameters.
4. At the registrar, publish that DS record without changing its digest,
   algorithm, or key-tag values.
5. Wait for parent-zone propagation and validate from an independent
   validating resolver.

DNSSEC authenticates DNS answers. It does not make a nonexistent agent
endpoint real, authenticate an application session, or create an HTTP API.

### 2.3 Verify SVCB/HTTPS answers and DNSSEC

These commands are read-only and are evidence only after an operator has
actually deployed the records:

```sh
set -eu
NAME='_a2a._agents.vuzora.ru'
dig +dnssec +adflag +multi "$NAME" SVCB
dig +dnssec +adflag +multi "$NAME" HTTPS
dig +dnssec +adflag +multi vuzora.ru DNSKEY
dig +dnssec +adflag +multi vuzora.ru DS
```

Check for the expected owner name, record type, target, SvcParamKey values,
`RRSIG` coverage, and the validating resolver's `ad` flag. An empty answer
or an answer without authenticated DNSSEC data is not a pass.

Use DNS-over-HTTPS as an independent read-only check. The `AD` value must be
true when the resolver has authenticated the answer:

```sh
set -eu
curl -fsS \
  -H 'accept: application/dns-json' \
  'https://cloudflare-dns.com/dns-query?name=_a2a._agents.vuzora.ru&type=SVCB' \
  -o /tmp/vuzora-dnsaid.json
jq -e '.Status == 0 and .AD == true and (.Answer | length) > 0' \
  /tmp/vuzora-dnsaid.json
```

Repeat with `type=HTTPS` if that record type is the approved deployment.
Do not treat a successful DoH request for a missing record as evidence of
DNS-AID deployment.

References:

- https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/
- https://www.rfc-editor.org/rfc/rfc9460
- https://www.cloudflare.com/dns/dnssec/

## 3. True `Accept: text/markdown` negotiation

### 3.1 Configure an edge implementation

GitHub Pages serves the committed static files and cannot select a
representation from `Accept` on its own. Use Cloudflare Markdown for Agents
or a reviewed Worker only after confirming that the selected product is
enabled for the zone.

Configure the edge behavior as follows:

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
   response's token count. It is not a static-site claim.
7. Keep redirects, status codes, access policy, and ordinary navigation
   unchanged.

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

Reference:

- https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/

## 4. Final negative checks and ownership record

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

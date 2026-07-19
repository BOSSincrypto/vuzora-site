import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

export const AUTH_BOUNDARY_PATH = "/auth.md";
export const AUTH_BOUNDARY_MEDIA_TYPE = "text/markdown";
export const DISCOVERY_NEGATIVE_PATHS = [
  "/.well-known/openid-configuration",
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-protected-resource",
  "/.well-known/mcp/server-card.json",
];

const CANONICAL_ORIGIN = "https://vuzora.ru";
const SECRET_RE =
  /\b(?:api[_-]?(?:key|token)|cloudflare|cf[-_]?api|sk_(?:live|test)(?:_[A-Za-z0-9]+)?|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-|bearer\s+[A-Za-z0-9\-._~+/]+=*|database_url|postgres(?:ql)?:\/\/\S+:\S+@|mongodb(?:\+srv)?:\/\/\S+:\S+@|AKIA[0-9A-Z]{16})\b/i;
const ACTIVE_ENDPOINT_RE =
  /\b(?:authorization_endpoint|token_endpoint|introspection_endpoint|revocation_endpoint|registration_endpoint|jwks_uri|issuer)\b\s*["':=]/i;
const ACTIVE_PROTOCOL_RE =
  /\b(?:remote|удалённ(?:ый|ого|ом))\s+mcp\b|\b(?:mcp\s+server|server\s+card|protected[-\s]+resource)\b\s*[:=]/i;
const ACTIVE_OAUTH_RE = /\b(?:oauth|oidc)\b[^.\n]{0,80}\b(?:provider|issuer|server|service|endpoint|flow)\b/i;
const NEGATIVE_CONTEXT_RE =
  /(?:нет|не\s|ниже|без|отсутств(?:ует|уют)|не\s+реализован|не\s+публику|не\s+выдаёт|не\s+означает|\bno\b|\bnot\b|\bwithout\b|\bdoes not\b|\bisn't\b|\bis not\b)/i;

function normalized(value) {
  return value.replace(/\r\n?/g, "\n").trim();
}

function assertNegativeClaim(text, pattern, message) {
  const match = text.match(pattern);
  if (!match) return;
  const context = text.slice(Math.max(0, match.index - 100), match.index);
  if (!NEGATIVE_CONTEXT_RE.test(context)) throw new Error(message);
}

export function assertAuthBoundaryDocument(value) {
  if (typeof value !== "string" || !normalized(value)) {
    throw new Error("auth.md must be a non-empty Markdown document");
  }
  const heading = normalized(value).match(/^#\s+(.+?)\s*$/m)?.[1]?.trim().toLowerCase();
  if (heading !== "auth.md") throw new Error("auth.md first H1 must be auth.md");
  if (!/нет\s+регистрации\s+и\s+входа/i.test(value))
    throw new Error("auth.md must state that registration and login are absent");
  if (!/\bOAuth\/OIDC\b/i.test(value) || !/\bissuer\b/i.test(value))
    throw new Error("auth.md must state that no OAuth/OIDC issuer exists");
  if (!/\btoken endpoint\b/i.test(value) || !/токен/i.test(value))
    throw new Error("auth.md must state that no token endpoint or tokens exist");
  if (!/защищённого\s+HTTP\s+API/i.test(value))
    throw new Error("auth.md must state that no protected HTTP API exists");
  if (!/аутентифицированного\s+сервиса/i.test(value))
    throw new Error("auth.md must state that no authenticated service exists");
  if (/\b(?:password|парол[ья]|client_secret|api[_-]?key)\s*[:=]/i.test(value))
    throw new Error("auth.md must not contain credentials or secret instructions");
  if (SECRET_RE.test(value)) throw new Error("auth.md contains secret-like credential material");
  if (/\b(?:https?:\/\/|www\.)/i.test(value))
    throw new Error("auth.md must not link to fictional authentication endpoints");
  assertNegativeClaim(value, ACTIVE_ENDPOINT_RE, "auth.md advertises an implemented auth endpoint");
  assertNegativeClaim(value, ACTIVE_PROTOCOL_RE, "auth.md advertises a remote MCP or protected-resource capability");
  assertNegativeClaim(value, ACTIVE_OAUTH_RE, "auth.md advertises an implemented OAuth/OIDC capability");
  return true;
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else files.push(path);
  }
  return files;
}

function assertDiscoveryText(text, label) {
  if (SECRET_RE.test(text)) throw new Error(`${label} contains secret-like credential material`);
  if (ACTIVE_ENDPOINT_RE.test(text))
    throw new Error(`${label} advertises an OAuth/OIDC endpoint`);
  assertNegativeClaim(text, ACTIVE_PROTOCOL_RE, `${label} advertises a remote MCP or protected-resource capability`);
  assertNegativeClaim(text, ACTIVE_OAUTH_RE, `${label} advertises an implemented OAuth/OIDC capability`);
  for (const pathname of DISCOVERY_NEGATIVE_PATHS) {
    if (text.includes(`${CANONICAL_ORIGIN}${pathname}`) || text.includes(`href="${pathname}"`)) {
      throw new Error(`${label} advertises a negative discovery path: ${pathname}`);
    }
  }
}

export async function assertDiscoveryBoundaryRelease({ root = process.cwd(), dist = join(root, "dist") } = {}) {
  const sourcePath = join(root, "public", AUTH_BOUNDARY_PATH.slice(1));
  const distPath = join(dist, AUTH_BOUNDARY_PATH.slice(1));
  if (!(await isFile(sourcePath))) throw new Error("auth.md source artifact is missing");
  if (!(await isFile(distPath))) throw new Error("auth.md release artifact is missing");
  const [source, built] = await Promise.all([readFile(sourcePath, "utf8"), readFile(distPath, "utf8")]);
  if (source.length === 0 || built.length === 0) throw new Error("auth.md artifact must be non-empty");
  if (source !== built) throw new Error("public/auth.md and dist/auth.md differ");
  assertAuthBoundaryDocument(built);

  const publicFiles = await filesUnder(join(root, "public"));
  const distFiles = await filesUnder(dist);
  const publicTexts = await Promise.all(
    publicFiles
      .filter((path) => /\.(?:md|txt|json|xml)$/i.test(path))
      .map(async (path) => [relative(join(root, "public"), path), await readFile(path, "utf8")]),
  );
  const distTexts = await Promise.all(
    distFiles
      .filter((path) => /\.(?:md|txt|json|xml)$/i.test(path))
      .map(async (path) => [relative(dist, path), await readFile(path, "utf8")]),
  );
  for (const [label, text] of [...publicTexts, ...distTexts]) assertDiscoveryText(text, label);

  for (const pathname of DISCOVERY_NEGATIVE_PATHS) {
    if (await isFile(join(dist, pathname.slice(1))))
      throw new Error(`negative discovery path has a release artifact: ${pathname}`);
    if (await isFile(join(root, "public", pathname.slice(1))))
      throw new Error(`negative discovery path has a source artifact: ${pathname}`);
  }
  return { authPath: AUTH_BOUNDARY_PATH, negativePaths: DISCOVERY_NEGATIVE_PATHS };
}

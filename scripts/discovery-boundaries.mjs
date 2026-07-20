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
const BINARY_EXTENSIONS = new Set([
  ".7z",
  ".avif",
  ".bin",
  ".bmp",
  ".class",
  ".db",
  ".dll",
  ".doc",
  ".docx",
  ".eot",
  ".exe",
  ".gif",
  ".gz",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp3",
  ".mp4",
  ".pdf",
  ".png",
  ".rar",
  ".so",
  ".tar",
  ".ttf",
  ".wav",
  ".wasm",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);
const SECRET_RE =
  /\b(?:api[_-]?(?:key|token)|cloudflare|cf[-_]?api|sk_(?:live|test)(?:_[A-Za-z0-9]+)?|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-|bearer\s+[A-Za-z0-9\-._~+/]+=*|database_url|postgres(?:ql)?:\/\/\S+:\S+@|mongodb(?:\+srv)?:\/\/\S+:\S+@|AKIA[0-9A-Z]{16})\b/i;
const ACTIVE_ENDPOINT_RE =
  /\b(?:authorization_endpoint|token_endpoint|introspection_endpoint|revocation_endpoint|registration_endpoint|jwks_uri|issuer)\b\s*["':=]/i;
const ACTIVE_PROTOCOL_RE =
  /\b(?:remote|удалённ(?:ый|ого|ом))\s+mcp\b|\b(?:mcp\s+server|server\s+card|protected[-\s]+resource)\b\s*[:=]/i;
const ACTIVE_OAUTH_RE = /\b(?:oauth|oidc)\b[^.\n]{0,80}\b(?:provider|issuer|server|service|endpoint|flow)\b/i;
const ACTIVE_UNSUPPORTED_RE =
  /(?:\b(?:http\s+api|api\s+(?:access|availability|endpoint|service|catalog)|official\s+(?:university\s+)?(?:service|partner)|protected[-\s]+resource(?:\s+support)?|remote\s+mcp|mcp\s+(?:server|integration)|server\s+card|oauth\/oidc\s+(?:issuer|provider|login|sign[-\s]?in|flow|endpoint)|(?:oauth|oidc)\s+(?:issuer|provider|login|sign[-\s]?in|flow))\b|(?:api\s+(?:доступ[а-яё]*|поддерж[а-яё]*|реализ[а-яё]*|предостав[а-яё]*|работ[а-яё]*)|oauth(?:\/oidc)?\s+(?:вход|логин|доступ[а-яё]*)|(?:вход|логин)\s+(?:через\s+)?(?:oauth|oidc|oauth\/oidc)|(?:удал(?:ённ|енн)[а-яё-]*\s+mcp|(?:официальн)[а-яё-]*\s+(?:сервис|партнёр|партнер)|(?:защищ[ёе]н)[а-яё-]*\s+ресурс|mcp[-\s]+сервер)))/i;
const NEGATIVE_CONTEXT_RE =
  /(?:нет|не\s|ниже|без|отсутств(?:ует|уют)|недоступ|не\s+реализован|не\s+публику|не\s+выдаёт|не\s+означает|\bno\b|\bnot\b|\bwithout\b|\bdoes not\b|\bdoesn't\b|\bisn't\b|\bis not\b|\bunavailable\b|\bunsupported\b|\bnor\b)/i;
const CONJUNCTION_RE =
  /(?<![\p{L}\p{N}_])(?:as\s+well\s+as|and|but|nor|or|yet|while|и|но|а|или|либо|зато|однако|при\s+этом)(?![\p{L}\p{N}_])/giu;
const ABSOLUTE_DISCOVERY_REFERENCE_RE =
  /(?:https?:)?\/\/[^"'`\s<>()]*?\/(?:[^"'`\s<>()]*\/)?\.well-known\/(?:openid-configuration|oauth-authorization-server|oauth-protected-resource|mcp\/server-card\.json)(?:\/)?(?:[?#][^"'`\s<>()]*)?/gi;
const RELATIVE_DISCOVERY_REFERENCE_RE =
  /(?:^|[\s"'`(=:#])((?:[^"'`\s<>()]*\/)?\.well-known\/(?:openid-configuration|oauth-authorization-server|oauth-protected-resource|mcp\/server-card\.json)(?:\/)?(?:[?#][^"'`\s<>()]*)?)/gim;

function normalized(value) {
  return value.replace(/\r\n?/g, "\n").trim();
}

function localContextStart(text, index) {
  let start = text.lastIndexOf("\n", index) + 1;
  for (const match of text.slice(0, index).matchAll(/[.!?;](?=\s|$)/g)) {
    start = Math.max(start, match.index + 1);
  }
  return start;
}

function assertNegativeClaim(text, pattern, message) {
  const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  for (const match of text.matchAll(globalPattern)) {
    const context = text.slice(localContextStart(text, match.index), match.index);
    if (!NEGATIVE_CONTEXT_RE.test(context)) throw new Error(message);
  }
}

function localUnsupportedClaimBounds(value, index, length) {
  const lineStart = value.lastIndexOf("\n", index) + 1;
  const lineEndIndex = value.indexOf("\n", index + length);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const before = value.slice(lineStart, index);
  const after = value.slice(index + length, lineEnd);
  const punctuationStart = Math.max(
    before.lastIndexOf("."),
    before.lastIndexOf("!"),
    before.lastIndexOf("?"),
    before.lastIndexOf(";"),
    before.lastIndexOf(":"),
    before.lastIndexOf(","),
  );
  const conjunctionsBefore = [...before.matchAll(CONJUNCTION_RE)];
  const lastConjunction = conjunctionsBefore.at(-1);
  const conjunctionStart =
    lastConjunction?.[0].toLowerCase() === "nor"
      ? lastConjunction.index
      : lastConjunction
        ? lastConjunction.index + lastConjunction[0].length
        : -1;
  const startOffset = Math.max(
    punctuationStart >= 0 ? punctuationStart + 1 : 0,
    conjunctionStart,
  );
  const punctuationEndCandidates = [".", "!", "?", ";", ":", ","]
    .map((boundary) => after.indexOf(boundary))
    .filter((boundary) => boundary >= 0);
  const conjunctionsAfter = [...after.matchAll(CONJUNCTION_RE)];
  const conjunctionEnd = conjunctionsAfter.length > 0 ? conjunctionsAfter[0].index : -1;
  const endOffsetCandidates = [...punctuationEndCandidates, conjunctionEnd].filter(
    (boundary) => boundary >= 0,
  );
  const endOffset =
    endOffsetCandidates.length > 0 ? Math.min(...endOffsetCandidates) : after.length;
  return {
    start: lineStart + startOffset,
    end: index + length + endOffset,
  };
}

export function assertNegativeUnsupportedClaim(value, label) {
  const globalPattern = new RegExp(
    ACTIVE_UNSUPPORTED_RE.source,
    ACTIVE_UNSUPPORTED_RE.flags.includes("g")
      ? ACTIVE_UNSUPPORTED_RE.flags
      : `${ACTIVE_UNSUPPORTED_RE.flags}g`,
  );
  for (const match of value.matchAll(globalPattern)) {
    const { start, end } = localUnsupportedClaimBounds(value, match.index, match[0].length);
    const context = `${value.slice(start, match.index)} ${value.slice(match.index + match[0].length, end)}`;
    if (!NEGATIVE_CONTEXT_RE.test(context))
      throw new Error(`${label} advertises an unsupported capability`);
  }
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
  assertNegativeUnsupportedClaim(value, "auth.md");
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

function isTextArtifact(path) {
  const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
  return !BINARY_EXTENSIONS.has(extension);
}

async function textArtifacts(files, base) {
  const artifacts = [];
  for (const path of files) {
    if (!isTextArtifact(path)) continue;
    const bytes = await readFile(path);
    if (bytes.includes(0)) continue;
    artifacts.push([relative(base, path), bytes.toString("utf8")]);
  }
  return artifacts;
}

function decodeReferenceText(value) {
  let decoded = value
    .replace(/\\u002f/gi, "/")
    .replace(/\\u005c/gi, "\\")
    .replace(/\\\//g, "/")
    .replace(/&sol;/gi, "/")
    .replace(/&#0*47;/gi, "/")
    .replace(/&#x0*2f;/gi, "/");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = decoded.replace(/(?:%[0-9a-f]{2})+/gi, (encoded) => {
      try {
        return decodeURIComponent(encoded);
      } catch {
        return encoded.replace(/%([0-9a-f]{2})/gi, (_, byte) => String.fromCharCode(Number.parseInt(byte, 16)));
      }
    });
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function normalizeDiscoveryReference(value) {
  const candidate = value.replace(/[),.;]+$/, "");
  try {
    const url = new URL(candidate, `${CANONICAL_ORIGIN}/`);
    if (url.hostname.toLowerCase() !== "vuzora.ru") return null;
    const pathname = decodeReferenceText(url.pathname).replace(/\/+$/, "");
    return DISCOVERY_NEGATIVE_PATHS.find((negativePath) => pathname === negativePath) ?? null;
  } catch {
    return null;
  }
}

function hasNegativeContext(text, index) {
  return NEGATIVE_CONTEXT_RE.test(text.slice(localContextStart(text, index), index));
}

function assertDiscoveryReferences(text, label) {
  const decoded = decodeReferenceText(text);
  const references = [
    ...Array.from(decoded.matchAll(ABSOLUTE_DISCOVERY_REFERENCE_RE), (match) => [match.index, match[0]]),
    ...Array.from(decoded.matchAll(RELATIVE_DISCOVERY_REFERENCE_RE), (match) => [match.index, match[1]]),
  ];
  for (const [index, reference] of references) {
    const pathname = normalizeDiscoveryReference(reference);
    if (pathname && !hasNegativeContext(decoded, index)) {
      throw new Error(`${label} advertises a negative discovery path: ${pathname}`);
    }
  }
}

function normalizedArtifactPath(path) {
  return `/${path
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .map((part) => decodeReferenceText(part))
    .join("/")}`;
}

function assertNoDiscoveryArtifacts(files, base, label) {
  for (const file of files) {
    const pathname = normalizedArtifactPath(relative(base, file));
    for (const negativePath of DISCOVERY_NEGATIVE_PATHS) {
      if (pathname === negativePath || pathname.startsWith(`${negativePath}/`)) {
        throw new Error(`${label} contains a release artifact at a negative discovery path: ${negativePath}`);
      }
    }
  }
}

function assertDiscoveryText(text, label) {
  if (SECRET_RE.test(text)) throw new Error(`${label} contains secret-like credential material`);
  if (ACTIVE_ENDPOINT_RE.test(text))
    throw new Error(`${label} advertises an OAuth/OIDC endpoint`);
  assertNegativeClaim(text, ACTIVE_PROTOCOL_RE, `${label} advertises a remote MCP or protected-resource capability`);
  assertNegativeClaim(text, ACTIVE_OAUTH_RE, `${label} advertises an implemented OAuth/OIDC capability`);
  assertDiscoveryReferences(text, label);
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
  const publicTexts = await textArtifacts(publicFiles, join(root, "public"));
  const distTexts = await textArtifacts(distFiles, dist);
  for (const [label, text] of [...publicTexts, ...distTexts]) assertDiscoveryText(text, label);

  assertNoDiscoveryArtifacts(publicFiles, join(root, "public"), "public");
  assertNoDiscoveryArtifacts(distFiles, dist, "dist");
  return { authPath: AUTH_BOUNDARY_PATH, negativePaths: DISCOVERY_NEGATIVE_PATHS };
}

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export const API_CATALOG_PATH = "/.well-known/api-catalog";
export const API_CATALOG_MEDIA_TYPE = "application/linkset+json";
export const API_CATALOG_ORIGIN = "https://vuzora.ru";
export const API_CATALOG_ANCHOR = `${API_CATALOG_ORIGIN}${API_CATALOG_PATH}`;

const STATIC_DISCOVERY_TYPES = new Map([
  ["/llms.txt", "text/plain"],
  ["/auth.md", "text/markdown"],
  ["/.well-known/agent-skills/index.json", "application/json"],
]);
const SECRET_RE =
  /\b(?:api[_-]?key|api[_-]?token|cloudflare|cf[-_]?api|sk_(?:live|test)(?:_[A-Za-z0-9]+)?|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-|bearer\s+[A-Za-z0-9\-._~+/]+=*|database_url|postgres(?:ql)?:\/\/\S+:\S+@|mongodb(?:\+srv)?:\/\/\S+:\S+@|AKIA[0-9A-Z]{16})\b/i;
const UNSUPPORTED_CAPABILITY_RE =
  /\b(?:openapi|swagger|health(?:check)?|oauth|oidc|authentication|protected\s+(?:resource|api)|token\s+endpoint|api\s+endpoint|executable\s+(?:api|endpoint)|remote\s+mcp|mcp\s+server|service\s+card)\b/i;

const jsonText = (value) => JSON.stringify(value);

function parseCatalog(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error(`API catalog JSON is malformed: ${error.message}`);
    }
  }
  return value;
}

function canonicalUrl(value) {
  if (typeof value !== "string" || !value)
    throw new Error("API catalog link href is missing");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`API catalog link href is not an absolute URL: ${value}`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== API_CATALOG_ORIGIN ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== value.slice(API_CATALOG_ORIGIN.length)
  )
    throw new Error(`API catalog link href is not a canonical production URL: ${value}`);
  return parsed.pathname;
}

export function buildApiCatalog() {
  return {
    description: "Vuzora does not implement an HTTP API.",
    linkset: [
      {
        anchor: API_CATALOG_ANCHOR,
        link: [
          {
            href: `${API_CATALOG_ORIGIN}/llms.txt`,
            rel: "describedby",
            type: "text/plain",
          },
        ],
      },
    ],
  };
}

export function assertApiCatalogMediaType(contentType) {
  if (typeof contentType !== "string" || !contentType.trim())
    throw new Error("API catalog Content-Type is missing");
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== API_CATALOG_MEDIA_TYPE)
    throw new Error(
      `API catalog Content-Type must be ${API_CATALOG_MEDIA_TYPE}, got ${contentType}`,
    );
  return mediaType;
}

export function assertApiCatalog(value, { availablePaths = ["/llms.txt"] } = {}) {
  const catalog = parseCatalog(value);
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog))
    throw new Error("API catalog must be a JSON object");
  if (Object.keys(catalog).sort().join(",") !== "description,linkset")
    throw new Error("API catalog must contain only description and linkset fields");
  if (
    typeof catalog.description !== "string" ||
    !/does not implement an HTTP API/i.test(catalog.description)
  )
    throw new Error("API catalog must state that no HTTP API is implemented");
  if (!Array.isArray(catalog.linkset) || catalog.linkset.length === 0)
    throw new Error("API catalog linkset array must contain at least one set");

  const available = new Set(availablePaths);
  const links = [];
  for (const [index, set] of catalog.linkset.entries()) {
    if (!set || typeof set !== "object" || Array.isArray(set))
      throw new Error(`API catalog linkset[${index}] must be an object`);
    if (set.anchor !== API_CATALOG_ANCHOR)
      throw new Error(`API catalog linkset[${index}] must use the catalog anchor`);
    if (!Array.isArray(set.link) || set.link.length === 0)
      throw new Error(`API catalog linkset[${index}] must contain links`);
    for (const [linkIndex, link] of set.link.entries()) {
      if (!link || typeof link !== "object" || Array.isArray(link))
        throw new Error(`API catalog linkset[${index}].link[${linkIndex}] must be an object`);
      if (Object.keys(link).sort().join(",") !== "href,rel,type")
        throw new Error("API catalog links must contain only href, rel, and type fields");
      const pathname = canonicalUrl(link.href);
      const expectedType = STATIC_DISCOVERY_TYPES.get(pathname);
      if (!expectedType || !available.has(pathname))
        throw new Error(`API catalog link must target a real static discovery document: ${link.href}`);
      if (link.rel !== "describedby" || link.type !== expectedType)
        throw new Error(`API catalog link has an unsupported relation or content type: ${link.href}`);
      links.push(pathname);
    }
  }
  if (new Set(links).size !== links.length)
    throw new Error("API catalog links must be unique");

  const text = jsonText(catalog);
  if (SECRET_RE.test(text))
    throw new Error("API catalog contains secret-like credential material");
  if (UNSUPPORTED_CAPABILITY_RE.test(text))
    throw new Error("API catalog advertises an unsupported API capability");
  return catalog;
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function availableStaticPaths(dist) {
  const paths = [];
  for (const pathname of STATIC_DISCOVERY_TYPES.keys()) {
    if (await isFile(join(dist, pathname.replace(/^\/+/, "")))) paths.push(pathname);
  }
  return paths;
}

export async function assertApiCatalogRelease({ root = process.cwd(), dist = join(root, "dist") } = {}) {
  const publicPath = join(root, "public", API_CATALOG_PATH.replace(/^\/+/, ""));
  const distPath = join(dist, API_CATALOG_PATH.replace(/^\/+/, ""));
  if (!(await isFile(publicPath))) throw new Error("API catalog source artifact is missing");
  if (!(await isFile(distPath))) throw new Error("API catalog release artifact is missing");
  const [publicBytes, distBytes] = await Promise.all([readFile(publicPath), readFile(distPath)]);
  if (publicBytes.length === 0 || distBytes.length === 0)
    throw new Error("API catalog artifact must be non-empty");
  if (!publicBytes.equals(distBytes))
    throw new Error("public API catalog and dist API catalog differ");
  const availablePaths = await availableStaticPaths(dist);
  assertApiCatalog(distBytes.toString("utf8"), { availablePaths });
  return { bytes: distBytes, availablePaths };
}

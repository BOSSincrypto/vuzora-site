import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  assertAuthBoundaryDocument,
  assertNegativeUnsupportedClaim as assertAuthUnsupportedClaim,
} from "./discovery-boundaries.mjs";

export const MARKDOWN_MEDIA_TYPE = "text/markdown";

// This is the deliberate, finite list of Markdown artifacts that may be
// copied into the Pages release. New files must be added here before they are
// considered public discovery surfaces.
export const MARKDOWN_ARTIFACTS = [
  {
    path: "auth.md",
    route: "/auth.md",
    identity: "auth.md",
    mediaType: MARKDOWN_MEDIA_TYPE,
  },
  {
    path: "unis.md",
    route: "/unis",
    identity: "Поддерживаемые вузы – Vuzora",
    mediaType: MARKDOWN_MEDIA_TYPE,
  },
  {
    path: ".well-known/agent-skills/public-site-discovery/SKILL.md",
    route: "/.well-known/agent-skills/public-site-discovery/SKILL.md",
    identity: "Vuzora public discovery",
    mediaType: MARKDOWN_MEDIA_TYPE,
  },
];

const SECRET_RE =
  /\b(?:api[_-]?(?:key|token)|cloudflare|cf[-_]?api|sk_(?:live|test)(?:_[A-Za-z0-9]+)?|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-|bearer\s+[A-Za-z0-9\-._~+/]+=*|database_url|postgres(?:ql)?:\/\/\S+:\S+@|mongodb(?:\+srv)?:\/\/\S+:\S+@|AKIA[0-9A-Z]{16})\b/i;
const ACTIVE_UNSUPPORTED_RE =
  /(?:\b(?:http\s+api|api\s+(?:access|availability|endpoint|service|catalog)|official\s+(?:university\s+)?(?:service|partner)|protected[-\s]+resource(?:\s+support)?|remote\s+mcp|mcp\s+(?:server|integration)|server\s+card|oauth\/oidc\s+(?:issuer|provider|login|sign[-\s]?in|flow|endpoint)|(?:oauth|oidc)\s+(?:issuer|provider|login|sign[-\s]?in|flow))\b|(?:api\s+(?:доступ[а-яё]*|поддерж[а-яё]*|реализ[а-яё]*|предостав[а-яё]*|работ[а-яё]*)|oauth(?:\/oidc)?\s+(?:вход|логин|доступ[а-яё]*)|(?:вход|логин)\s+(?:через\s+)?(?:oauth|oidc|oauth\/oidc)|(?:удал(?:ённ|енн)[а-яё-]*\s+mcp|(?:официальн)[а-яё-]*\s+(?:сервис|партнёр|партнер)|(?:защищ[ёе]н)[а-яё-]*\s+ресурс|mcp[-\s]+сервер)))/i;
const NEGATIVE_CONTEXT_RE =
  /(?:нет|не\s|ниже|без|отсутств(?:ует|уют|ует)|недоступ|не\s+(?:доступ|поддерж|реализ|публи|выда|означ|явля|существ)|\bno\b|\bnot\b|\bwithout\b|\bdoes not\b|\bdoesn't\b|\bisn't\b|\bis not\b|\bunavailable\b|\bunsupported\b|\bnor\b)/i;
const CONJUNCTION_RE =
  /(?<![\p{L}\p{N}_])(?:as\s+well\s+as|and|but|nor|or|yet|while|и|но|а|или|либо|зато|однако|при\s+этом)(?![\p{L}\p{N}_])/giu;

function normalized(value) {
  return value.replace(/\r\n?/g, "\n").trim();
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

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function markdownFiles(files, root) {
  return files
    .filter((path) => /\.md$/i.test(path))
    .map((path) => relative(root, path).split("\\").join("/"))
    .sort();
}

function firstHeading(value) {
  return normalized(value).match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() ?? "";
}

function localClaimBounds(value, index, length) {
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
  const endOffset = endOffsetCandidates.length > 0 ? Math.min(...endOffsetCandidates) : after.length;
  const start = lineStart + startOffset;
  const end = index + length + endOffset;
  return { start, end };
}

function assertNegativeUnsupportedClaim(value, label) {
  const globalPattern = new RegExp(
    ACTIVE_UNSUPPORTED_RE.source,
    ACTIVE_UNSUPPORTED_RE.flags.includes("g") ? ACTIVE_UNSUPPORTED_RE.flags : `${ACTIVE_UNSUPPORTED_RE.flags}g`,
  );
  for (const match of value.matchAll(globalPattern)) {
    const { start, end } = localClaimBounds(value, match.index, match[0].length);
    const context = `${value.slice(start, match.index)} ${value.slice(match.index + match[0].length, end)}`;
    if (!NEGATIVE_CONTEXT_RE.test(context))
      throw new Error(`${label} advertises an unsupported capability`);
  }
}

const UNIS_DETAIL_LINK_RE = /\(\/unis\/([a-z0-9-]+)\)/g;

/**
 * Bijective join between `public/unis.md` and the university registry.
 *
 * `llms.txt` and `blog/rss.xml` are generated and join-checked, but `unis.md`
 * is hand-maintained: without this gate a registry addition, rename, or
 * removal leaves the published catalogue silently stale while every other
 * release check still passes. Universities are supplied by the caller so this
 * module stays free of a `route-policy.mjs` import cycle.
 *
 * @param {string} body Markdown source of `unis.md`.
 * @param {Array<{ slug: string, code: string, name: string, city: string }>} universities
 * @param {string} [label] Prefix used in thrown messages.
 */
export function assertUnisMarkdownRegistryJoin(body, universities, label = "unis.md") {
  if (typeof body !== "string" || !body.trim()) throw new Error(`${label} is empty or missing`);

  const registry = (universities ?? []).filter((university) => university?.slug);
  const expected = registry.map((university) => university.slug);
  const expectedSet = new Set(expected);
  const found = [...body.matchAll(UNIS_DETAIL_LINK_RE)].map((match) => match[1]);
  const foundSet = new Set(found);

  const missing = expected.filter((slug) => !foundSet.has(slug));
  if (missing.length)
    throw new Error(`${label} underlist: missing registry detail link(s): ${missing.join(", ")}`);

  const phantom = [...new Set(found.filter((slug) => !expectedSet.has(slug)))];
  if (phantom.length)
    throw new Error(`${label} overlist: phantom slug(s) not in registry: ${phantom.join(", ")}`);

  if (found.length !== expected.length) {
    const counts = new Map();
    for (const slug of found) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);
    throw new Error(
      duplicates.length
        ? `${label} join failed: duplicate detail link(s): ${duplicates.join(", ")}`
        : `${label} join count mismatch: expected ${expected.length} detail links, found ${found.length}`,
    );
  }

  // Identity fields must travel with the link, so a rename in the registry
  // cannot leave a stale display name or city behind in the catalogue.
  const lines = body.split("\n");
  for (const university of registry) {
    const line = lines.find((candidate) => candidate.includes(`(/unis/${university.slug})`));
    for (const [field, value] of [
      ["code", university.code],
      ["name", university.name],
      ["city", university.city],
    ]) {
      if (value && !line.includes(value))
        throw new Error(`${label}: ${university.slug} row does not carry the registry ${field}`);
    }
  }
}

export function assertMarkdownArtifact(value, entry, label = entry.path) {
  if (entry.mediaType !== MARKDOWN_MEDIA_TYPE)
    throw new Error(`${label} must declare media type ${MARKDOWN_MEDIA_TYPE}`);
  if (typeof value !== "string" || !normalized(value))
    throw new Error(`${label} must be a non-empty Markdown document`);
  if (value.includes("\0")) throw new Error(`${label} contains binary NUL bytes`);
  if (/^\s*<!doctype\s+html\b|<html\b/i.test(value))
    throw new Error(`${label} must not be an HTML document`);
  if (firstHeading(value) !== entry.identity)
    throw new Error(`${label} must identify ${entry.identity} in its first H1`);
  const routeToken = entry.route.replace(/^\/+/, "");
  if (!value.includes(entry.route) && !value.includes(routeToken))
    throw new Error(`${label} must identify its explicit route ${entry.route}`);
  if (SECRET_RE.test(value)) throw new Error(`${label} contains secret-like credential material`);
  if (entry.path === "auth.md") {
    assertAuthBoundaryDocument(value);
    assertAuthUnsupportedClaim(value, label);
  } else {
    assertNegativeUnsupportedClaim(value, label);
  }
  return true;
}

function assertManifestEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0)
    throw new Error("release manifest Markdown inventory must be non-empty");
  const paths = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("release manifest Markdown entry must be an object");
    if (Object.keys(entry).sort().join(",") !== "identity,mediaType,path,route")
      throw new Error("release manifest Markdown entry has unsupported fields");
    if (
      typeof entry.path !== "string" ||
      !entry.path ||
      entry.path.startsWith("/") ||
      entry.path.includes("..") ||
      !/\.md$/i.test(entry.path)
    )
      throw new Error(`release manifest Markdown path is unsafe: ${entry.path}`);
    if (paths.has(entry.path)) throw new Error(`duplicate Markdown manifest path: ${entry.path}`);
    paths.add(entry.path);
    if (typeof entry.route !== "string" || !entry.route.startsWith("/"))
      throw new Error(`Markdown manifest route is invalid for ${entry.path}`);
    if (typeof entry.identity !== "string" || !entry.identity.trim())
      throw new Error(`Markdown manifest identity is missing for ${entry.path}`);
    if (entry.mediaType !== MARKDOWN_MEDIA_TYPE)
      throw new Error(`Markdown manifest media type is invalid for ${entry.path}`);
  }
  return entries;
}

export async function assertMarkdownRelease({
  root = process.cwd(),
  dist = join(root, "dist"),
  manifest,
} = {}) {
  const entries = assertManifestEntries(manifest ?? []);
  const sourceRoot = join(root, "public");
  const sourceFiles = markdownFiles(await filesUnder(sourceRoot), sourceRoot);
  const distFiles = markdownFiles(await filesUnder(dist), dist);
  const manifestPaths = entries.map((entry) => entry.path).sort();
  if (sourceFiles.join("\n") !== manifestPaths.join("\n"))
    throw new Error("public Markdown inventory disagrees with release manifest");
  if (distFiles.join("\n") !== manifestPaths.join("\n"))
    throw new Error("dist Markdown inventory disagrees with release manifest");

  for (const entry of entries) {
    const sourcePath = join(sourceRoot, entry.path);
    const distPath = join(dist, entry.path);
    if (!(await isFile(sourcePath)) || !(await isFile(distPath)))
      throw new Error(`Markdown manifest entry has no matching artifact: ${entry.path}`);
    const [sourceBytes, distBytes] = await Promise.all([readFile(sourcePath), readFile(distPath)]);
    if (sourceBytes.length === 0 || distBytes.length === 0)
      throw new Error(`Markdown artifact must be non-empty: ${entry.path}`);
    if (!sourceBytes.equals(distBytes))
      throw new Error(`public/${entry.path} and dist/${entry.path} differ`);
    let source;
    let built;
    try {
      source = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes);
      built = new TextDecoder("utf-8", { fatal: true }).decode(distBytes);
    } catch {
      throw new Error(`Markdown artifact is not valid UTF-8: ${entry.path}`);
    }
    assertMarkdownArtifact(source, entry, `public/${entry.path}`);
    assertMarkdownArtifact(built, entry, `dist/${entry.path}`);

    // Route-specific representations must coexist with their browser-default
    // HTML artifact. No extensionless file is allowed to become Markdown.
    if (!entry.route.endsWith(".md")) {
      const extensionless = join(dist, entry.route.replace(/^\/+/, ""));
      if (await isFile(extensionless))
        throw new Error(`extensionless route has a Markdown fallback artifact: ${entry.route}`);
    }
  }
  return { entries };
}

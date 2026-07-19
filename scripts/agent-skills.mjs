import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

export const AGENT_SKILLS_INDEX_PATH = "/.well-known/agent-skills/index.json";
export const AGENT_SKILLS_SCHEMA =
  "https://schemas.agentskills.io/discovery/0.2.0/schema.json";
export const AGENT_SKILLS_ORIGIN = "https://vuzora.ru";
export const SKILL_ARTIFACT_PATH =
  "/.well-known/agent-skills/public-site-discovery/SKILL.md";
export const SKILL_NAME = "vuzora-public-discovery";
export const SKILL_DESCRIPTION =
  "Read-only guidance for discovering Vuzora's public university directory and Telegram schedule-delivery pages.";
export const AGENT_SKILLS_MEDIA_TYPES = new Set(["text/markdown", "text/plain"]);

const NAME_RE = /^(?!-)(?!.*--)[a-z0-9-]{1,64}(?<!-)$/;
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const UNSUPPORTED_CAPABILITY_RE =
  /\b(?:oauth|mcp|commerce|payment|api(?:[-_ ]?(?:key|token|server))?|live\s+(?:schedule|timetable)|real[- ]time\s+(?:schedule|timetable)|official\s+partner)\b/i;
const SECRET_RE =
  /\b(?:api[_-]?key|api[_-]?token|cloudflare|cf[-_]?api|sk_live|sk_test|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-|bearer\s+[A-Za-z0-9\-._~+/]+=*|database_url|postgres(?:ql)?:\/\/\S+:\S+@|mongodb(?:\+srv)?:\/\/\S+:\S+@|AKIA[0-9A-Z]{16})\b/i;

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (Buffer.isBuffer(value)) return value;
  throw new TypeError("Agent Skills artifact must be raw bytes");
}

function decodeUtf8(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`SKILL.md is not valid UTF-8: ${error.message}`);
  }
}

function digestFor(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function assertAgentSkillsMediaType(contentType, url = "SKILL.md") {
  if (typeof contentType !== "string" || !contentType.trim())
    throw new Error(`SKILL.md Content-Type is missing for ${url}`);
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  if (!AGENT_SKILLS_MEDIA_TYPES.has(mediaType))
    throw new Error(
      `SKILL.md Content-Type must be text/markdown or text/plain for ${url}, got ${contentType}`,
    );
  return mediaType;
}

function canonicalSkillUrl(value) {
  if (typeof value !== "string" || !value) throw new Error("Agent Skills artifact URL is missing");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Agent Skills artifact URL is not absolute: ${value}`);
  }
  if (parsed.href !== value)
    throw new Error(`Agent Skills artifact URL is not canonical HTTPS: ${value}`);
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== AGENT_SKILLS_ORIGIN ||
    parsed.search ||
    parsed.hash ||
    !parsed.pathname.startsWith("/.well-known/agent-skills/") ||
    !parsed.pathname.endsWith("/SKILL.md")
  )
    throw new Error(`Agent Skills artifact URL is not canonical HTTPS: ${value}`);
  return parsed.href;
}

function parseFrontmatter(bytes) {
  const markdown = decodeUtf8(bytes);
  const opening = markdown.match(/^---(?:\r\n|\n|\r|$)/);
  if (!opening) throw new Error("SKILL.md is missing YAML frontmatter");
  const closing = markdown.slice(opening[0].length).match(/^---(?:\r\n|\n|\r|$)/m);
  if (!closing) throw new Error("SKILL.md frontmatter is not closed");
  const frontmatter = markdown.slice(
    opening[0].length,
    opening[0].length + closing.index,
  );
  const fields = new Map();
  const parseScalar = (field, source) => {
    const value = source.trim();
    if (!value) throw new Error(`SKILL.md frontmatter ${field} is empty`);
    if (value.startsWith("'")) {
      const quoted = value.match(/^'((?:''|[^'])*)'(?:[ \t]+#.*)?$/);
      if (!quoted) throw new Error(`SKILL.md frontmatter ${field} has an unterminated quote`);
      const inner = quoted[1];
      for (let index = 0; index < inner.length; index += 1) {
        if (inner[index] === "'") {
          if (inner[index + 1] !== "'") {
            throw new Error(`SKILL.md frontmatter ${field} has an invalid quote`);
          }
          index += 1;
        }
      }
      return inner.replaceAll("''", "'");
    }
    if (value.startsWith('"')) {
      const quoted = value.match(/^("(?:\\.|[^"\\])*")(?:[ \t]+#.*)?$/);
      if (!quoted) throw new Error(`SKILL.md frontmatter ${field} has an unterminated quote`);
      try {
        const parsed = JSON.parse(quoted[1]);
        if (typeof parsed !== "string") throw new Error("not a string");
        return parsed;
      } catch {
        throw new Error(`SKILL.md frontmatter ${field} has an invalid quoted value`);
      }
    }
    return value.replace(/[ \t]+#.*/, "").trim();
  };
  let nestedField;
  let metadataIndent;
  let metadataEmptyMap = false;
  const nestedMetadataKeys = new Set();
  for (const line of frontmatter.split(/\r\n|\n|\r/)) {
    if (/^\t/.test(line))
      throw new Error(`SKILL.md frontmatter uses tabs for indentation: ${line}`);
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (/^\s/.test(line)) {
      if (nestedField !== "metadata")
        throw new Error(`SKILL.md frontmatter has an unexpected indented mapping: ${line}`);
      if (metadataEmptyMap)
        throw new Error("SKILL.md frontmatter metadata: {} cannot have child keys");
      const indentation = line.match(/^ */)[0].length;
      if (!metadataIndent) metadataIndent = indentation;
      if (indentation !== metadataIndent || indentation < 2)
        throw new Error(`SKILL.md frontmatter has inconsistent metadata indentation: ${line}`);
      const nestedMapping = line.match(
        /^ {2,}([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/,
      );
      if (!nestedMapping)
        throw new Error(`SKILL.md frontmatter has a malformed metadata mapping: ${line}`);
      const nestedKey = nestedMapping[1];
      if (nestedMetadataKeys.has(nestedKey))
        throw new Error(`SKILL.md frontmatter duplicates metadata.${nestedKey}`);
      nestedMetadataKeys.add(nestedKey);
      parseScalar(`metadata.${nestedKey}`, nestedMapping[2]);
      continue;
    }
    const mapping = line.match(/^([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/);
    if (!mapping) throw new Error(`SKILL.md frontmatter has a malformed mapping: ${line}`);
    const [, field, source] = mapping;
    if (fields.has(field)) throw new Error(`SKILL.md frontmatter duplicates ${field}`);
    if (!["name", "description", "license", "compatibility", "metadata", "allowed-tools"].includes(field))
      throw new Error(`SKILL.md frontmatter has an unsupported field: ${field}`);
    if (field === "metadata") {
      if (source.trim() && source.trim() !== "{}")
        throw new Error("SKILL.md frontmatter metadata must be an indented mapping");
      fields.set(field, source.trim() || "{}");
      metadataEmptyMap = source.trim() === "{}";
      metadataIndent = undefined;
      nestedMetadataKeys.clear();
    } else {
      fields.set(field, parseScalar(field, source));
    }
    nestedField = field === "metadata" ? field : undefined;
  }
  const name = fields.get("name") ?? "";
  const description = fields.get("description") ?? "";
  if (!name || !description) throw new Error("SKILL.md frontmatter requires name and description");
  if (!NAME_RE.test(name)) throw new Error(`SKILL.md frontmatter name is invalid: ${name}`);
  if (description.length > 1024)
    throw new Error("SKILL.md frontmatter description is too long");
  return { name, description, markdown };
}

export function buildAgentSkillsIndex(
  artifactBytes,
  { name = SKILL_NAME, description = SKILL_DESCRIPTION } = {},
) {
  const bytes = asBytes(artifactBytes);
  const url = `${AGENT_SKILLS_ORIGIN}${SKILL_ARTIFACT_PATH}`;
  return {
    $schema: AGENT_SKILLS_SCHEMA,
    skills: [{ name, type: "skill-md", description, url, digest: digestFor(bytes) }],
  };
}

export function assertAgentSkillsArtifact(artifactBytes, entry, transport = undefined) {
  const bytes = asBytes(artifactBytes);
  if (entry?.type !== "skill-md") throw new Error("Agent Skills entry type must be skill-md");
  const url = canonicalSkillUrl(entry.url);
  if (transport && Object.hasOwn(transport, "contentType"))
    assertAgentSkillsMediaType(transport.contentType, url);
  if (entry.digest !== digestFor(bytes))
    throw new Error(`Agent Skills digest mismatch for ${url}`);
  const frontmatter = parseFrontmatter(bytes);
  if (frontmatter.name !== entry.name) throw new Error(`SKILL.md name mismatch for ${url}`);
  if (frontmatter.description !== entry.description)
    throw new Error(`SKILL.md description mismatch for ${url}`);
  if (SECRET_RE.test(frontmatter.markdown))
    throw new Error(`SKILL.md contains secret-like credential material: ${url}`);
  if (UNSUPPORTED_CAPABILITY_RE.test(frontmatter.markdown))
    throw new Error(`SKILL.md advertises unsupported capability: ${url}`);
  return frontmatter;
}

export async function assertAgentSkillsFetchedArtifact(response, entry) {
  if (!response || typeof response.arrayBuffer !== "function")
    throw new TypeError("Agent Skills artifact response must provide raw bytes");
  const url = canonicalSkillUrl(entry?.url);
  if (!response.ok || response.status < 200 || response.status >= 300)
    throw new Error(`SKILL.md artifact is not reachable: HTTP ${response.status ?? "unknown"} for ${url}`);
  if (typeof response.url !== "string" || response.url !== url)
    throw new Error(`SKILL.md artifact response URL is not canonical HTTPS: ${response.url}`);
  const contentType = response.headers?.get?.("content-type");
  const bytes = Buffer.from(await response.arrayBuffer());
  const frontmatter = assertAgentSkillsArtifact(bytes, entry, { contentType });
  return { bytes, contentType, frontmatter };
}

export function assertAgentSkillsIndex(index, artifactBytesByUrl = new Map()) {
  const parsed = typeof index === "string" ? JSON.parse(index) : index;
  if (!parsed || typeof parsed !== "object" || parsed.$schema !== AGENT_SKILLS_SCHEMA)
    throw new Error("Agent Skills index has an unsupported or missing v0.2.0 schema");
  if (!Array.isArray(parsed.skills) || parsed.skills.length === 0)
    throw new Error("Agent Skills index must contain at least one skill");
  const names = new Set();
  const urls = new Set();
  for (const entry of parsed.skills) {
    if (!entry || typeof entry !== "object") throw new Error("Agent Skills entry must be an object");
    if (typeof entry.name !== "string" || !NAME_RE.test(entry.name))
      throw new Error(`Agent Skills name is invalid: ${entry.name ?? ""}`);
    if (names.has(entry.name)) throw new Error(`Agent Skills contains duplicate name: ${entry.name}`);
    names.add(entry.name);
    if (entry.type !== "skill-md") throw new Error("Agent Skills entry uses unsupported artifact type");
    if (
      typeof entry.description !== "string" ||
      !entry.description.trim() ||
      entry.description.length > 1024
    )
      throw new Error(`Agent Skills description is missing or too long: ${entry.name}`);
    const url = canonicalSkillUrl(entry.url);
    if (urls.has(url)) throw new Error(`Agent Skills contains duplicate URL: ${url}`);
    urls.add(url);
    if (!DIGEST_RE.test(entry.digest)) throw new Error(`Agent Skills digest is malformed: ${entry.name}`);
    const metadata = `${entry.name}\n${entry.description}\n${url}`;
    if (SECRET_RE.test(metadata)) throw new Error(`Agent Skills metadata contains secret-like content: ${entry.name}`);
    if (UNSUPPORTED_CAPABILITY_RE.test(metadata))
      throw new Error(`Agent Skills metadata advertises unsupported capability: ${entry.name}`);
    const bytes = artifactBytesByUrl.get(url);
    if (bytes !== undefined) assertAgentSkillsArtifact(bytes, { ...entry, url });
  }
  return parsed;
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function localArtifactPath(dist, url) {
  const parsed = new URL(canonicalSkillUrl(url));
  return join(dist, parsed.pathname.replace(/^\/+/, ""));
}

export async function assertAgentSkillsRelease({ root = process.cwd(), dist = join(root, "dist") } = {}) {
  // Local artifact validation intentionally stays byte-based. The mission's
  // static server serves .md as application/octet-stream, so accepted Markdown
  // media types are asserted only on fetched production responses.
  const indexPath = join(dist, AGENT_SKILLS_INDEX_PATH.replace(/^\/+/, ""));
  if (!(await isFile(indexPath))) throw new Error("Agent Skills release is missing index.json");
  const indexBytes = await readFile(indexPath);
  let index;
  try {
    index = JSON.parse(indexBytes.toString("utf8"));
  } catch (error) {
    throw new Error(`Agent Skills index JSON is malformed: ${error.message}`);
  }
  const artifacts = new Map();
  for (const entry of index.skills ?? []) {
    const artifactPath = localArtifactPath(dist, entry.url);
    if (!(await isFile(artifactPath)))
      throw new Error(`Agent Skills release is missing artifact: ${relative(dist, artifactPath)}`);
    artifacts.set(canonicalSkillUrl(entry.url), await readFile(artifactPath));
  }
  assertAgentSkillsIndex(index, artifacts);

  const publicIndexPath = join(root, "public", AGENT_SKILLS_INDEX_PATH.replace(/^\/+/, ""));
  if (await isFile(publicIndexPath)) {
    const publicIndex = await readFile(publicIndexPath);
    if (!publicIndex.equals(indexBytes))
      throw new Error("public Agent Skills index and dist index.json differ");
  }
  for (const entry of index.skills) {
    const artifactPath = localArtifactPath(dist, entry.url);
    const publicArtifactPath = join(root, "public", new URL(entry.url).pathname.replace(/^\/+/, ""));
    if (await isFile(publicArtifactPath)) {
      const artifact = await readFile(artifactPath);
      const publicArtifact = await readFile(publicArtifactPath);
      if (!publicArtifact.equals(artifact))
        throw new Error(`public Agent Skills artifact and dist artifact differ: ${entry.name}`);
    }
  }
  return index;
}

export async function writeAgentSkillsIndex({ root = process.cwd(), artifactBytes } = {}) {
  const bytes = artifactBytes ?? (await readFile(join(root, "public", SKILL_ARTIFACT_PATH.replace(/^\/+/, ""))));
  const index = buildAgentSkillsIndex(bytes);
  const path = join(root, "public", AGENT_SKILLS_INDEX_PATH.replace(/^\/+/, ""));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return index;
}

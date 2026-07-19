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
  const opening = markdown.match(/^---(?:\r?\n|$)/);
  if (!opening) throw new Error("SKILL.md is missing YAML frontmatter");
  const closing = markdown.slice(opening[0].length).match(/^---\s*(?:\r?\n|$)/m);
  if (!closing) throw new Error("SKILL.md frontmatter is not closed");
  const frontmatter = markdown.slice(
    opening[0].length,
    opening[0].length + closing.index,
  );
  const readField = (name) => {
    const line = frontmatter.match(new RegExp(`^${name}:[ \\t]*([^\\r\\n]+)`, "m"));
    return line?.[1]?.replace(/^(['"])(.*)\1$/, "$2").trim() ?? "";
  };
  const name = readField("name");
  const description = readField("description");
  if (!name || !description) throw new Error("SKILL.md frontmatter requires name and description");
  if (!NAME_RE.test(name)) throw new Error(`SKILL.md frontmatter name is invalid: ${name}`);
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

export function assertAgentSkillsArtifact(artifactBytes, entry) {
  const bytes = asBytes(artifactBytes);
  if (entry?.type !== "skill-md") throw new Error("Agent Skills entry type must be skill-md");
  const url = canonicalSkillUrl(entry.url);
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

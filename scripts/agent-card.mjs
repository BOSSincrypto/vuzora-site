import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  A2A_PATH,
  A2A_PROTOCOL_BINDING,
  A2A_PROTOCOL_VERSION,
} from "../edge/a2a-agent.mjs";

export const AGENT_CARD_PATH = "/.well-known/agent-card.json";
export const AGENT_CARD_MEDIA_TYPE = "application/json";
export const AGENT_CARD_ORIGIN = "https://vuzora.ru";
export const AGENT_CARD_INTERFACE_URL = `${AGENT_CARD_ORIGIN}${A2A_PATH}`;
export const AGENT_CARD_VERSION = "1.0.0";

const REQUIRED_FIELDS = [
  "name",
  "description",
  "supportedInterfaces",
  "version",
  "capabilities",
  "defaultInputModes",
  "defaultOutputModes",
  "skills",
];
const REQUIRED_SKILL_FIELDS = ["id", "name", "description", "tags"];
const SKILL_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SECRET_RE =
  /\b(?:api[_-]?key|api[_-]?token|cloudflare|cf[-_]?api|sk_(?:live|test)(?:_[A-Za-z0-9]+)?|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-|bearer\s+[A-Za-z0-9\-._~+/]+=*|database_url|postgres(?:ql)?:\/\/\S+:\S+@|mongodb(?:\+srv)?:\/\/\S+:\S+@|AKIA[0-9A-Z]{16})\b/i;
// The card is the loudest capability claim the site makes, so the words that
// would overstate it are refused outright rather than reviewed by eye.
const UNSUPPORTED_CAPABILITY_RE =
  /\b(?:oauth|oidc|openapi|swagger|mcp|payment|commerce|official\s+partner|live\s+(?:schedule|timetable)|real[- ]time\s+(?:schedule|timetable))\b/i;

/**
 * Files the card may name as a target.
 *
 * Every URL in the card other than the interface is a static artifact, and
 * `assertAgentCardRelease` checks each one exists in `dist` before the release
 * ships. A card that links a file the release does not publish is the same
 * fabricated capability as one that names a dead endpoint.
 */
const STATIC_TARGETS = new Map([
  ["/", "the site root"],
  ["/llms.txt", "the discovery packet"],
  ["/icon-192.png", "the site icon"],
]);

const jsonText = (value) => JSON.stringify(value);

function parseCard(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Agent Card JSON is malformed: ${error.message}`);
  }
}

/**
 * The pathname of a canonical production URL, or a thrown error.
 *
 * @param {unknown} value
 * @param {string} label
 */
function canonicalUrl(value, label) {
  if (typeof value !== "string" || !value) throw new Error(`Agent Card ${label} is missing`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Agent Card ${label} is not an absolute URL: ${value}`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== AGENT_CARD_ORIGIN ||
    parsed.search ||
    parsed.hash ||
    parsed.href !== value
  )
    throw new Error(`Agent Card ${label} is not a canonical production URL: ${value}`);
  return parsed.pathname;
}

/**
 * The Agent Card this repository publishes.
 *
 * Two skills, because two are what `edge/a2a-agent.mjs` actually implements.
 * `capabilities` is false across the board and `securitySchemes` is absent for
 * the same reason: the endpoint is a single unauthenticated `SendMessage`, and
 * a card that claimed streaming, push, or an authenticated extended card would
 * be describing an agent that does not exist.
 *
 * @see https://a2a-protocol.org/latest/specification/#8-agent-discovery-the-agent-card
 */
export function buildAgentCard() {
  return {
    name: "Vuzora Discovery Agent",
    description:
      "Read-only agent over Vuzora's published catalogue. It reports which Russian universities have a published Vuzora page and returns the Markdown mirror of any public page. It does not deliver timetables, and Vuzora is not an official university service.",
    supportedInterfaces: [
      {
        url: AGENT_CARD_INTERFACE_URL,
        protocolBinding: A2A_PROTOCOL_BINDING,
        protocolVersion: A2A_PROTOCOL_VERSION,
      },
    ],
    provider: {
      organization: "Vuzora",
      url: `${AGENT_CARD_ORIGIN}/`,
    },
    iconUrl: `${AGENT_CARD_ORIGIN}/icon-192.png`,
    version: AGENT_CARD_VERSION,
    documentationUrl: `${AGENT_CARD_ORIGIN}/llms.txt`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false,
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/markdown", "text/plain"],
    skills: [
      {
        id: "university-lookup",
        name: "University coverage lookup",
        description:
          "Given a university name, abbreviation, or slug, answers whether Vuzora publishes a page for it and returns that page as Markdown. Answers are read from the published catalogue and never contain class times.",
        tags: ["universities", "catalogue", "discovery", "russian"],
        examples: ["МГУ", "msu", "is HSE covered?"],
        outputModes: ["text/markdown", "text/plain"],
      },
      {
        id: "page-markdown",
        name: "Published page as Markdown",
        description:
          "Given the path of a public Vuzora page, returns the curated Markdown mirror the release publishes for it.",
        tags: ["markdown", "documentation", "discovery"],
        examples: ["/unis/msu/", "/pricing/", "/legal/privacy/"],
        outputModes: ["text/markdown", "text/plain"],
      },
    ],
  };
}

/**
 * @param {unknown} contentType
 */
export function assertAgentCardMediaType(contentType) {
  if (typeof contentType !== "string" || !contentType.trim())
    throw new Error("Agent Card Content-Type is missing");
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== AGENT_CARD_MEDIA_TYPE)
    throw new Error(
      `Agent Card Content-Type must be ${AGENT_CARD_MEDIA_TYPE}, got ${contentType}`,
    );
  return mediaType;
}

/**
 * @param {unknown} interfaces
 */
function assertInterfaces(interfaces) {
  if (!Array.isArray(interfaces) || interfaces.length === 0)
    throw new Error("Agent Card supportedInterfaces must list at least one interface");
  for (const [index, entry] of interfaces.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error(`Agent Card supportedInterfaces[${index}] must be an object`);
    const pathname = canonicalUrl(entry.url, `supportedInterfaces[${index}].url`);
    if (pathname !== A2A_PATH)
      throw new Error(
        `Agent Card supportedInterfaces[${index}].url must be the deployed endpoint ${A2A_PATH}`,
      );
    if (entry.protocolBinding !== A2A_PROTOCOL_BINDING)
      throw new Error(
        `Agent Card supportedInterfaces[${index}].protocolBinding must be ${A2A_PROTOCOL_BINDING}`,
      );
    if (entry.protocolVersion !== A2A_PROTOCOL_VERSION)
      throw new Error(
        `Agent Card supportedInterfaces[${index}].protocolVersion must be ${A2A_PROTOCOL_VERSION}`,
      );
  }
}

/**
 * @param {unknown} skills
 */
function assertSkills(skills) {
  if (!Array.isArray(skills) || skills.length === 0)
    throw new Error("Agent Card skills must list at least one skill");
  const ids = new Set();
  for (const [index, skill] of skills.entries()) {
    if (!skill || typeof skill !== "object" || Array.isArray(skill))
      throw new Error(`Agent Card skills[${index}] must be an object`);
    for (const field of REQUIRED_SKILL_FIELDS)
      if (skill[field] === undefined)
        throw new Error(`Agent Card skills[${index}] is missing ${field}`);
    if (typeof skill.id !== "string" || !SKILL_ID_RE.test(skill.id))
      throw new Error(`Agent Card skills[${index}].id must be a kebab-case identifier`);
    if (ids.has(skill.id)) throw new Error(`Agent Card skill id is repeated: ${skill.id}`);
    ids.add(skill.id);
    for (const field of ["name", "description"])
      if (typeof skill[field] !== "string" || !skill[field].trim())
        throw new Error(`Agent Card skills[${index}].${field} must be a non-empty string`);
    if (!Array.isArray(skill.tags) || skill.tags.length === 0)
      throw new Error(`Agent Card skills[${index}].tags must list at least one tag`);
  }
  return [...ids];
}

/**
 * The card, validated against the specification and this site's boundaries.
 *
 * @param {unknown} value Parsed card or its JSON text.
 * @param {{ availablePaths?: string[] }} [options] Static paths the release publishes.
 */
export function assertAgentCard(value, { availablePaths = [...STATIC_TARGETS.keys()] } = {}) {
  const card = parseCard(value);
  if (!card || typeof card !== "object" || Array.isArray(card))
    throw new Error("Agent Card must be a JSON object");
  for (const field of REQUIRED_FIELDS)
    if (card[field] === undefined) throw new Error(`Agent Card is missing ${field}`);

  for (const field of ["name", "description", "version"])
    if (typeof card[field] !== "string" || !card[field].trim())
      throw new Error(`Agent Card ${field} must be a non-empty string`);

  assertInterfaces(card.supportedInterfaces);

  // Everything that is not the endpoint must be a file the release ships.
  const available = new Set(availablePaths);
  for (const [label, url] of [
    ["provider.url", card.provider?.url],
    ["iconUrl", card.iconUrl],
    ["documentationUrl", card.documentationUrl],
  ]) {
    if (url === undefined) continue;
    const pathname = canonicalUrl(url, label);
    if (!STATIC_TARGETS.has(pathname) || !available.has(pathname))
      throw new Error(`Agent Card ${label} must target a published artifact: ${url}`);
  }
  if (card.provider !== undefined && typeof card.provider?.organization !== "string")
    throw new Error("Agent Card provider.organization must be a string");

  const { capabilities } = card;
  if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities))
    throw new Error("Agent Card capabilities must be an object");
  // `edge/a2a-agent.mjs` answers `UnsupportedOperationError` for every one of
  // these. Declaring one true here would make the card contradict the endpoint.
  for (const capability of ["streaming", "pushNotifications", "extendedAgentCard"])
    if (capabilities[capability] !== false)
      throw new Error(`Agent Card capabilities.${capability} must be false`);

  if (card.securitySchemes !== undefined || card.securityRequirements !== undefined)
    throw new Error("Agent Card must not declare a security scheme: the endpoint is open");
  if (card.signatures !== undefined)
    throw new Error("Agent Card must not carry a signature this repository cannot produce");

  for (const field of ["defaultInputModes", "defaultOutputModes"])
    if (!Array.isArray(card[field]) || card[field].length === 0)
      throw new Error(`Agent Card ${field} must list at least one media type`);

  assertSkills(card.skills);

  const text = jsonText(card);
  if (SECRET_RE.test(text)) throw new Error("Agent Card contains secret-like credential material");
  if (UNSUPPORTED_CAPABILITY_RE.test(text))
    throw new Error("Agent Card advertises an unsupported capability");
  return card;
}

/** Serialized exactly as the release publishes it. */
export function serializeAgentCard(card = buildAgentCard()) {
  return `${JSON.stringify(card, null, 2)}\n`;
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
  for (const pathname of STATIC_TARGETS.keys()) {
    // `/` is the site root: `index.html` is the file that answers it.
    const file = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    if (await isFile(join(dist, file))) paths.push(pathname);
  }
  return paths;
}

/**
 * Write `public/.well-known/agent-card.json` from the builder above.
 *
 * @param {{ root?: string }} [options]
 */
export async function writeAgentCard({ root = process.cwd() } = {}) {
  const card = assertAgentCard(buildAgentCard());
  const path = join(root, "public", AGENT_CARD_PATH.replace(/^\/+/, ""));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serializeAgentCard(card), "utf8");
  return card;
}

/**
 * @param {{ root?: string, dist?: string }} [options]
 */
export async function assertAgentCardRelease({
  root = process.cwd(),
  dist = join(root, "dist"),
} = {}) {
  const relative = AGENT_CARD_PATH.replace(/^\/+/, "");
  const publicPath = join(root, "public", relative);
  const distPath = join(dist, relative);
  if (!(await isFile(publicPath))) throw new Error("Agent Card source artifact is missing");
  if (!(await isFile(distPath))) throw new Error("Agent Card release artifact is missing");
  const [publicBytes, distBytes] = await Promise.all([readFile(publicPath), readFile(distPath)]);
  if (publicBytes.length === 0 || distBytes.length === 0)
    throw new Error("Agent Card artifact must be non-empty");
  if (!publicBytes.equals(distBytes))
    throw new Error("public Agent Card and dist Agent Card differ");

  const availablePaths = await availableStaticPaths(dist);
  const card = assertAgentCard(distBytes.toString("utf8"), { availablePaths });
  // The generator is the source of truth: a hand-edited card would pass every
  // rule above and still drift from what `buildAgentCard` produces.
  if (distBytes.toString("utf8") !== serializeAgentCard())
    throw new Error("Agent Card differs from the generator; run bun run generate:agent-card");
  return { card, bytes: distBytes, availablePaths };
}

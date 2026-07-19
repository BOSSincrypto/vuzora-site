import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  AGENT_SKILLS_INDEX_PATH,
  AGENT_SKILLS_SCHEMA,
  SKILL_ARTIFACT_PATH,
  assertAgentSkillsArtifact,
  assertAgentSkillsIndex,
  assertAgentSkillsRelease,
  buildAgentSkillsIndex,
} from "./agent-skills.mjs";

const root = process.cwd();
const validSkill = (name = "example-skill") =>
  Buffer.from(
    `---\nname: ${name}\ndescription: Read-only guidance for a public site.\n---\n\n# Example skill\n\nUse this skill to inspect public, non-secret content.\n`,
    "utf8",
  );

test("builds and validates a v0.2.0 Agent Skills index from exact raw bytes", () => {
  const bytes = validSkill();
  const index = buildAgentSkillsIndex(bytes, {
    name: "example-skill",
    description: "Read-only guidance for a public site.",
  });
  assert.equal(index.$schema, AGENT_SKILLS_SCHEMA);
  assert.equal(index.skills[0].type, "skill-md");
  assert.match(index.skills[0].url, /^https:\/\/vuzora\.ru\/\.well-known\/agent-skills\/.+\/SKILL\.md$/);
  assert.doesNotThrow(() => assertAgentSkillsIndex(index, new Map([[index.skills[0].url, bytes]])));
  assert.doesNotThrow(() => assertAgentSkillsArtifact(bytes, index.skills[0]));
});

test("rejects malformed, non-canonical, unsupported, and secret-bearing index entries", () => {
  const bytes = validSkill();
  const index = buildAgentSkillsIndex(bytes, {
    name: "example-skill",
    description: "Read-only guidance for a public site.",
  });
  const cases = [
    ["wrong schema", { ...index, $schema: "https://schemas.agentskills.io/discovery/0.1.0/schema.json" }],
    ["relative URL", { ...index, skills: [{ ...index.skills[0], url: "SKILL.md" }] }],
    ["trailing slash URL", { ...index, skills: [{ ...index.skills[0], url: `${index.skills[0].url}/` }] }],
    ["bad digest", { ...index, skills: [{ ...index.skills[0], digest: "sha256:ABC" }] }],
    ["unsupported capability", { ...index, skills: [{ ...index.skills[0], description: "OAuth API access" }] }],
    ["secret", { ...index, skills: [{ ...index.skills[0], description: "Use api_key=secret" }] }],
  ];
  for (const [label, fixture] of cases) {
    assert.throws(
      () => assertAgentSkillsIndex(fixture),
      /schema|URL|canonical|digest|unsupported|secret|capabilit/i,
      label,
    );
  }
});

test("rejects digest mismatches and invalid SKILL.md frontmatter", () => {
  const bytes = validSkill();
  const index = buildAgentSkillsIndex(bytes, {
    name: "example-skill",
    description: "Read-only guidance for a public site.",
  });
  assert.throws(
    () => assertAgentSkillsIndex(index, new Map([[index.skills[0].url, Buffer.from(`${bytes}x`)]])),
    /digest/i,
  );
  assert.throws(
    () =>
      assertAgentSkillsArtifact(
        Buffer.from("# Missing frontmatter\n", "utf8"),
        buildAgentSkillsIndex(Buffer.from("# Missing frontmatter\n", "utf8")).skills[0],
      ),
    /frontmatter/i,
  );
  const renamed = Buffer.from(
    bytes.toString("utf8").replace("name: example-skill", "name: another-skill"),
    "utf8",
  );
  assert.throws(
    () =>
      assertAgentSkillsArtifact(renamed, {
        ...buildAgentSkillsIndex(renamed).skills[0],
        name: "example-skill",
      }),
    /name|frontmatter/i,
  );
  const secret = Buffer.from(`${bytes.toString("utf8")}api_key=secret\n`, "utf8");
  assert.throws(
    () =>
      assertAgentSkillsArtifact(
        secret,
        buildAgentSkillsIndex(secret, {
          name: "example-skill",
          description: "Read-only guidance for a public site.",
        }).skills[0],
      ),
    /secret|credential/i,
  );
});

test("release validation fails closed for missing, malformed, and mismatched artifacts", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "vuzora-agent-skills-"));
  try {
    await cp(root, fixtureRoot, {
      recursive: true,
      filter: (source) => !source.includes("node_modules"),
    });
    const dist = join(fixtureRoot, "dist");
    const indexPath = join(dist, AGENT_SKILLS_INDEX_PATH.replace(/^\//, ""));
    const originalIndex = JSON.parse(await readFile(indexPath, "utf8"));
    const artifactPath = join(dist, SKILL_ARTIFACT_PATH.replace(/^\//, ""));
    const fixtures = [
      ["missing artifact", async () => rm(artifactPath), /Agent Skills|missing|artifact/i],
      [
        "digest mismatch",
        async () => writeFile(artifactPath, `${await readFile(artifactPath, "utf8")}x`, "utf8"),
        /Agent Skills|digest/i,
      ],
      [
        "non-canonical URL",
        async () =>
          writeFile(
            indexPath,
            `${JSON.stringify({
              ...originalIndex,
              skills: [{ ...originalIndex.skills[0], url: originalIndex.skills[0].url.replace("https://vuzora.ru", "https://example.com") }],
            })}\n`,
            "utf8",
          ),
        /Agent Skills|canonical|URL/i,
      ],
    ];
    for (const [label, mutate, message] of fixtures) {
      await cp(root, fixtureRoot, {
        recursive: true,
        filter: (source) => !source.includes("node_modules"),
      });
      await mutate();
      await assert.rejects(() => assertAgentSkillsRelease({ root: fixtureRoot, dist }), message, label);
    }
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

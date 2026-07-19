import { writeAgentSkillsIndex } from "./agent-skills.mjs";

const index = await writeAgentSkillsIndex();
console.log(
  `Generated Agent Skills v0.2.0 index with ${index.skills.length} skill artifact(s).`,
);

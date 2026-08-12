import { writeAgentCard } from "./agent-card.mjs";

const card = await writeAgentCard();
console.log(
  `Generated A2A Agent Card ${card.version} with ${card.skills.length} skill(s) for ${card.supportedInterfaces[0].url}.`,
);

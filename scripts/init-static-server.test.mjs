import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const missionDir = process.env.VUZORA_MISSION_DIR;
const initScript = missionDir && join(missionDir, "init.sh");
const servicesManifest = missionDir && join(missionDir, "services.yaml");

const read = (path) => readFile(join(root, path), "utf8");
const readRequiredMissionFile = async (path, name) => {
  assert.ok(
    missionDir,
    `VUZORA_MISSION_DIR must point to a mission directory containing ${name}`,
  );

  try {
    return await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Required mission setup input is unavailable: ${path}`, {
      cause: error,
    });
  }
};
const mimeEntry = (source, extension) =>
  source.match(new RegExp(`\\s+"${extension}":\\s+"([^"]+)"`))?.[1];

test("repository and bootstrap static servers agree on Markdown MIME", async () => {
  const [server, init, services] = await Promise.all([
    read("scripts/static-server.mjs"),
    readRequiredMissionFile(initScript, "init.sh"),
    readRequiredMissionFile(servicesManifest, "services.yaml"),
  ]);

  assert.equal(mimeEntry(server, "\\.md"), "text/markdown; charset=utf-8");
  assert.equal(mimeEntry(init, "\\.md"), mimeEntry(server, "\\.md"));
  assert.match(services, /web:\s*[\s\S]*?start:\s*PORT=3100 node .*scripts\/static-server\.mjs/);
  assert.match(services, /web:\s*[\s\S]*?port:\s*3100/);
});

test("bootstrap generation stays guarded and never starts the server", async () => {
  const init = await readRequiredMissionFile(initScript, "init.sh");
  assert.match(init, /if \[\[ ! -f \/tmp\/vuzora-static-server\.mjs \]\]; then/);
  assert.doesNotMatch(init, /^\s*(?:nohup\s+)?(?:node|bun|npm)\s+.*static-server\.mjs/m);
  assert.match(init, /fi\s*$/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const defaultBootstrapDir = join(root, "scripts", "fixtures", "bootstrap");
const resolveBootstrapDir = (missionDir) => missionDir ?? defaultBootstrapDir;
const bootstrapDir = resolveBootstrapDir(process.env.VUZORA_MISSION_DIR);
const initScript = join(bootstrapDir, "init.sh");
const servicesManifest = join(bootstrapDir, "services.yaml");

const read = (path) => readFile(join(root, path), "utf8");
const readRequiredBootstrapFile = async (path, name) => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Required bootstrap setup input ${name} is unavailable: ${path}`, {
      cause: error,
    });
  }
};
const mimeEntry = (source, extension) =>
  source.match(new RegExp(`\\s+"${extension}":\\s+"([^"]+)"`))?.[1];

test("repository and bootstrap static servers agree on Markdown MIME", async () => {
  const [server, init, services] = await Promise.all([
    read("scripts/static-server.mjs"),
    readRequiredBootstrapFile(initScript, "init.sh"),
    readRequiredBootstrapFile(servicesManifest, "services.yaml"),
  ]);

  assert.equal(mimeEntry(server, "\\.md"), "text/markdown; charset=utf-8");
  assert.equal(mimeEntry(init, "\\.md"), mimeEntry(server, "\\.md"));
  assert.match(services, /web:\s*[\s\S]*?start:\s*PORT=3100 node .*scripts\/static-server\.mjs/);
  assert.match(services, /web:\s*[\s\S]*?port:\s*3100/);
});

test("bootstrap generation stays guarded and never starts the server", async () => {
  const init = await readRequiredBootstrapFile(initScript, "init.sh");
  assert.match(init, /if \[\[ ! -f \/tmp\/vuzora-static-server\.mjs \]\]; then/);
  assert.doesNotMatch(init, /^\s*(?:nohup\s+)?(?:node|bun|npm)\s+.*static-server\.mjs/m);
  assert.match(init, /fi\s*$/);
});

test("default bootstrap fixtures are repository-relative", () => {
  assert.equal(resolveBootstrapDir(undefined), defaultBootstrapDir);
  assert.equal(
    resolveBootstrapDir("/explicit/mission"),
    "/explicit/mission",
  );
});

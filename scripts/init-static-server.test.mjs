import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const initScript =
  process.env.VUZORA_INIT_SCRIPT ??
  "/Users/klavdiamakovna/.factory/missions/7f8b9e6a-ccd5-4cf3-9458-319ead2fe951/init.sh";

const read = (path) => readFile(join(root, path), "utf8");
const mimeEntry = (source, extension) =>
  source.match(new RegExp(`\\s+"${extension}":\\s+"([^"]+)"`))?.[1];

test("repository and bootstrap static servers agree on Markdown MIME", async (t) => {
  try {
    await access(initScript);
  } catch {
    t.skip(`mission bootstrap is not available at ${initScript}`);
    return;
  }

  const [server, init, services] = await Promise.all([
    read("scripts/static-server.mjs"),
    readFile(initScript, "utf8"),
    readFile(
      "/Users/klavdiamakovna/.factory/missions/7f8b9e6a-ccd5-4cf3-9458-319ead2fe951/services.yaml",
      "utf8",
    ),
  ]);

  assert.equal(mimeEntry(server, "\\.md"), "text/markdown; charset=utf-8");
  assert.equal(mimeEntry(init, "\\.md"), mimeEntry(server, "\\.md"));
  assert.match(services, /web:\s*[\s\S]*?start:\s*PORT=3100 node .*scripts\/static-server\.mjs/);
  assert.match(services, /web:\s*[\s\S]*?port:\s*3100/);
});

test("bootstrap generation stays guarded and never starts the server", async (t) => {
  try {
    await access(initScript);
  } catch {
    t.skip(`mission bootstrap is not available at ${initScript}`);
    return;
  }

  const init = await readFile(initScript, "utf8");
  assert.match(init, /if \[\[ ! -f \/tmp\/vuzora-static-server\.mjs \]\]; then/);
  assert.doesNotMatch(init, /^\s*(?:nohup\s+)?(?:node|bun|npm)\s+.*static-server\.mjs/m);
  assert.match(init, /fi\s*$/);
});

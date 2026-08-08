import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const bun = process.env.BUN_BIN ?? "bun";
const bunArgs = process.env.BUN_BIN_ARGS ? process.env.BUN_BIN_ARGS.split(" ").filter(Boolean) : [];
const tempRoot = await mkdtemp(join(tmpdir(), "vuzora-release-"));
const first = join(tempRoot, "first");
const second = join(tempRoot, "second");

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: { ...process.env, CI: "true", TZ: "UTC", SOURCE_DATE_EPOCH: "0" },
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code ?? signal}`)),
    );
  });
}

try {
  await cp(root, first, {
    recursive: true,
    // Compare on URL-style separators: on Windows these paths arrive with
    // backslashes, the filter never matches, and the "clean" workspace ends up
    // a copy of node_modules, dist, and .git.
    filter: (source) => {
      const path = source.split("\\").join("/");
      return (
        !path.includes("/node_modules/") &&
        !path.endsWith("/node_modules") &&
        !path.includes("/dist/") &&
        !path.endsWith("/dist") &&
        !path.includes("/.git/") &&
        !path.endsWith("/.git")
      );
    },
  });
  await cp(first, second, { recursive: true });
  for (const workspace of [first, second]) {
    await run(bun, [...bunArgs, "install", "--frozen-lockfile"], workspace);
    await run(bun, [...bunArgs, "run", "build"], workspace);
    await run(bun, [...bunArgs, "run", "validate:release"], workspace);
  }
  await run(
    process.execPath,
    [join(root, "scripts/compare-release.mjs"), join(first, "dist"), join(second, "dist")],
    root,
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

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
    filter: (source) =>
      !source.includes("/node_modules/") &&
      !source.includes("/dist/") &&
      !source.includes("/.git/"),
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

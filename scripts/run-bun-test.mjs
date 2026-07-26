import { spawnSync } from "node:child_process";

export function runPinnedBun(source, options = {}) {
  const spawnOptions = {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options,
  };
  const direct = spawnSync("bun", ["-e", source], spawnOptions);
  if (
    direct.status === 0 ||
    (direct.error?.code !== "ENOENT" &&
      !/Bun's postinstall script was not run/i.test(direct.stderr ?? ""))
  ) {
    return direct;
  }
  // No local bun: fetch the pinned version, matching the suite's other callers.
  // (`node --import tsx` is not an option — tsx is not a dependency here.)
  return spawnSync("npx", ["--yes", "bun@1.3.14", "-e", source], spawnOptions);
}

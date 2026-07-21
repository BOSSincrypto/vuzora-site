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
  return spawnSync(process.execPath, ["--import", "tsx", "-e", source], spawnOptions);
}

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Run a snippet under the pinned Bun and return the raw spawn result.
 *
 * Bun is the only runtime here that imports `src/content/*.ts` directly, so
 * every check that needs real content values — rather than a regex over the
 * source — goes through this.
 *
 * Three tiers, because how `bun` is installed decides which one can work:
 *
 * 1. Direct `spawnSync("bun", …)`. What CI gets from `oven-sh/setup-bun`.
 * 2. A temp script executed through the platform shell. On Windows an
 *    npm-installed Bun is a shell shim, and Node refuses to exec `.cmd`
 *    directly (EINVAL) or cannot resolve the extensionless shim (ENOENT).
 *    Only the shell can launch it. The command string is built entirely from
 *    a path we generated, so `shell: true` has no injection surface — the
 *    snippet itself travels in the file, never on the command line.
 * 3. `npx bun@1.3.14`, for a machine with no Bun at all.
 *
 * (`node --import tsx` is not an option — tsx is not a dependency here.)
 */
export function runPinnedBun(source, options = {}) {
  const spawnOptions = {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options,
  };
  const direct = spawnSync("bun", ["-e", source], spawnOptions);
  if (usable(direct)) return direct;

  const viaShell = runFromTempScript("bun", source, spawnOptions);
  if (usable(viaShell)) return viaShell;

  const viaNpx = spawnSync("npx", ["--yes", "bun@1.3.14", "-e", source], spawnOptions);
  if (usable(viaNpx)) return viaNpx;

  return runFromTempScript("npx --yes bun@1.3.14", source, spawnOptions);
}

/** A result is usable when Bun actually ran, whatever it then reported. */
function usable(result) {
  return (
    result.status === 0 ||
    (result.error === undefined &&
      result.status !== null &&
      !/Bun's postinstall script was not run/i.test(result.stderr ?? ""))
  );
}

/**
 * `bun -e` resolves relative specifiers against the working directory; a file
 * resolves them against its own directory. Rewriting them to absolute
 * `file://` URLs keeps a snippet written for `-e` working from anywhere — and
 * "anywhere" has to mean outside the repository, because the release fixture
 * tests copy the whole project root and a snippet appearing and vanishing
 * inside it makes that copy race.
 */
function absolutizeRelativeSpecifiers(source, directory) {
  const base = pathToFileURL(join(directory, "snippet.mjs"));
  return source.replace(
    /(\bfrom\s*|\bimport\s*\(\s*)(["'])(\.\.?\/[^"']+)\2/g,
    (_match, head, quote, specifier) => `${head}${quote}${new URL(specifier, base).href}${quote}`,
  );
}

function runFromTempScript(launcher, source, spawnOptions) {
  const workingDirectory = spawnOptions.cwd ?? process.cwd();
  const directory = mkdtempSync(join(tmpdir(), "vuzora-bun-"));
  const script = join(directory, "snippet.mjs");
  try {
    writeFileSync(script, absolutizeRelativeSpecifiers(source, workingDirectory), "utf8");
    return spawnSync(`${launcher} "${script}"`, { ...spawnOptions, shell: true });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const manifest = join(root, "dist", "release-manifest.json");

try {
  await access(manifest);
} catch {
  await new Promise((resolve, reject) => {
    const child = spawn(join(root, "node_modules", ".bin", "vite"), ["build"], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`vite build exited with ${code ?? `signal ${signal}`}`));
    });
  });

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, "scripts", "prepare-release.mjs")], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`release preparation exited with ${code ?? `signal ${signal}`}`));
    });
  });
}

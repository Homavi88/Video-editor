#!/usr/bin/env node
/**
 * Stage 11 packaging helper: builds the web/renderer bundle and writes a
 * runnable directory layout. Full Electron installers (deb/AppImage) can wrap
 * this output when electron-builder is configured in a release environment.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const outDir = path.join(root, "dist", "lumina-linux");

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: true });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

run("npm", ["run", "build"]);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.cpSync(path.join(root, "apps/desktop/dist"), path.join(outDir, "renderer"), { recursive: true });
fs.cpSync(path.join(root, "apps/desktop/electron"), path.join(outDir, "electron"), { recursive: true });
fs.writeFileSync(
  path.join(outDir, "README.txt"),
  `Lumina Linux package (Stage 11)\n\n1. npm i -g electron (or use local node_modules/electron)\n2. electron ./electron/main.mjs\n\nRenderer assets are in ./renderer\n`,
);
console.log(`Packed to ${outDir}`);

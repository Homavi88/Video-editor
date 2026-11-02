#!/usr/bin/env node
/**
 * Builds the renderer and invokes electron-builder when available.
 * Falls back to pack-linux.mjs layout if electron-builder is not installed.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function run(cmd, args, cwd = root) {
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: true });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

run("npm", ["run", "build", "-w", "@lumina/desktop"]);

const builderBin = path.join(root, "node_modules", ".bin", "electron-builder");
if (fs.existsSync(builderBin)) {
  run(builderBin, ["--config", "apps/desktop/electron-builder.yml"], root);
} else {
  console.warn("electron-builder not installed — writing portable pack via pack-linux.mjs");
  run("node", ["scripts/pack-linux.mjs"]);
}

/**
 * Restricts media API paths to an allowlist of roots (cache, tmp, cwd, home Movies).
 * Mitigates arbitrary filesystem read if the Vite server is exposed.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function defaultAllowedRoots(extra: string[] = []): string[] {
  const roots = [
    path.resolve(".lumina-cache"),
    path.resolve("apps/desktop/.lumina-cache"),
    path.resolve(process.cwd()),
    path.join(os.tmpdir(), "lumina-export"),
    path.join(os.tmpdir()),
    path.join(os.homedir(), "Movies"),
    path.join(os.homedir(), "Videos"),
    ...extra,
  ];
  return [...new Set(roots.map((r) => path.resolve(r)))];
}

/** Returns resolved absolute path when allowed; throws otherwise. */
export function assertAllowedPath(
  filePath: string,
  roots: readonly string[] = defaultAllowedRoots(),
): string {
  if (!filePath || filePath.includes("\0")) {
    throw new Error("invalid path");
  }
  const resolved = path.resolve(filePath);
  const ok = roots.some((root) => {
    const r = path.resolve(root);
    return resolved === r || resolved.startsWith(r + path.sep);
  });
  if (!ok) {
    throw new Error(`path outside allowed roots: ${resolved}`);
  }
  // Reject symlinks that escape roots
  try {
    const real = fs.realpathSync(resolved);
    const realOk = roots.some((root) => {
      const r = path.resolve(root);
      try {
        const rr = fs.existsSync(r) ? fs.realpathSync(r) : r;
        return real === rr || real.startsWith(rr + path.sep);
      } catch {
        return real === r || real.startsWith(r + path.sep);
      }
    });
    if (!realOk) throw new Error(`symlink escapes allowed roots: ${resolved}`);
    return real;
  } catch (err) {
    // File may not exist yet (export output) — allow if parent is under a root
    const parent = path.dirname(resolved);
    const parentOk = roots.some((root) => {
      const r = path.resolve(root);
      return parent === r || parent.startsWith(r + path.sep);
    });
    if (!parentOk) {
      throw err instanceof Error ? err : new Error(String(err));
    }
    return resolved;
  }
}

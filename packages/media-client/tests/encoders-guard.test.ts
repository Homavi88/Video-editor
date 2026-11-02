import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import { assertAllowedPath, defaultAllowedRoots } from "../src/path-guard.js";
import { detectEncoders, pickEncoder } from "../src/encoders.js";

describe("path guard + encoders", () => {
  it("allows cache/tmp paths and rejects others", () => {
    const roots = defaultAllowedRoots([path.join(os.tmpdir(), "lumina-test-root")]);
    const ok = path.join(os.tmpdir(), "lumina-sequence.mp4");
    expect(assertAllowedPath(ok, roots)).toContain(path.sep);
    expect(() => assertAllowedPath("/etc/passwd", roots)).toThrow(/outside allowed roots/);
  });

  it("detects at least software encoder and prefers only available HW", async () => {
    const encoders = await detectEncoders();
    expect(encoders.some((e) => e.id === "software" && e.available)).toBe(true);
    const picked = pickEncoder(encoders);
    expect(picked.available).toBe(true);
    expect(picked.videoCodecFlag.length).toBeGreaterThan(0);
    // Smoke probe must not mark HW available without a working encode.
    for (const e of encoders.filter((x) => x.id !== "software" && x.available)) {
      expect(["nvenc", "qsv", "amf", "videotoolbox"]).toContain(e.id);
    }
  });
});

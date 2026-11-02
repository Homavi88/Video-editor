import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { probeFile, buildProxyArgs } from "../src/probe.js";

describe("probeFile", () => {
  it("probes a generated wav with ffprobe", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lumina-probe-"));
    const wav = path.join(dir, "tone.wav");
    const res = spawnSync(
      "ffmpeg",
      ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", wav],
      { encoding: "utf8" },
    );
    expect(res.status).toBe(0);
    return probeFile(wav).then((result) => {
      expect(result.kind).toBe("audio");
      expect(result.metadata.hasAudio).toBe(true);
      expect(Number(result.metadata.duration)).toBeGreaterThan(0);
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  it("builds proxy args", () => {
    const args = buildProxyArgs("in.mp4", "proxy.mp4");
    expect(args).toContain("libx264");
    expect(args.at(-1)).toBe("proxy.mp4");
  });
});

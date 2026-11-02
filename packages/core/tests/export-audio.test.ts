import { describe, expect, it } from "vitest";
import { buildFfmpegArgs, createExportJob, getExportPreset } from "../src/export/presets.js";
import { duckMusicGain, detectSilence, dbToGain } from "../src/audio/automation.js";
import { getTransitionPreset } from "../src/transitions/catalog.js";
import { getEffectPreset } from "../src/effects/catalog.js";

describe("export + audio helpers", () => {
  it("requires patent acknowledgement for H.264 presets", () => {
    expect(() =>
      createExportJob({
        presetId: "youtube-4k",
        sequenceId: "s1",
        outputPath: "/tmp/out.mp4",
      }),
    ).toThrow(/patent/i);
    const job = createExportJob({
      presetId: "youtube-4k",
      sequenceId: "s1",
      outputPath: "/tmp/out.mp4",
      patentAcknowledged: true,
    });
    expect(job.status).toBe("queued");
  });

  it("builds ffmpeg args for AV1 web preset", () => {
    const preset = getExportPreset("webm-av1")!;
    const args = buildFfmpegArgs(preset, "in.mov", "out.webm");
    expect(args).toContain("libaom-av1");
    expect(args.at(-1)).toBe("out.webm");
  });

  it("ducks and detects silence", () => {
    expect(duckMusicGain(1, 0.8)).toBeLessThan(1);
    expect(dbToGain(0)).toBeCloseTo(1);
    const samples = new Float32Array(10000);
    for (let i = 0; i < 1000; i += 1) samples[i] = 0.5;
    const ranges = detectSilence(samples, { threshold: 0.01, minSamples: 100 });
    expect(ranges.length).toBeGreaterThan(0);
  });

  it("resolves catalogs", () => {
    expect(getTransitionPreset("crossDissolve")?.category).toBe("dissolve");
    expect(getEffectPreset("builtin.blur.gaussian")?.label).toBe("Gaussian Blur");
  });
});

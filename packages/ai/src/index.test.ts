import { describe, expect, it } from "vitest";
import {
  autoReframe9x16,
  createTranscriptionJob,
  detectScenesFromLuma,
  runDemoTranscription,
  transcriptionToCues,
} from "./index.js";
import { FRAME_RATES, frameDurationTicks } from "@lumina/core";

describe("ai module", () => {
  it("produces demo captions", () => {
    const job = runDemoTranscription(createTranscriptionJob("/tmp/a.mov"));
    expect(transcriptionToCues(job).length).toBeGreaterThan(0);
  });

  it("detects luma scenes and reframes", () => {
    const cuts = detectScenesFromLuma([0.1, 0.1, 0.9, 0.9], frameDurationTicks(FRAME_RATES.fps25));
    expect(cuts.length).toBe(1);
    const box = autoReframe9x16(0.5, 0.5);
    expect(box.width).toBeGreaterThan(0);
    expect(box.width).toBeLessThanOrEqual(1);
  });
});

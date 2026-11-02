import { describe, expect, it } from "vitest";
import {
  FRAME_RATES,
  framesToTicks,
  frameDurationTicks,
  secondsToTicks,
  ticksToFrames,
  ticksToSeconds,
  TICKS_PER_SECOND,
} from "../src/util/time.js";

describe("time utilities", () => {
  it("round-trips whole seconds", () => {
    expect(secondsToTicks(1)).toBe(TICKS_PER_SECOND);
    expect(ticksToSeconds(TICKS_PER_SECOND)).toBe(1);
  });

  it("computes exact frame durations for integer fps", () => {
    expect(frameDurationTicks(FRAME_RATES.fps25)).toBe(TICKS_PER_SECOND / 25n);
    expect(framesToTicks(25, FRAME_RATES.fps25)).toBe(TICKS_PER_SECOND);
    expect(ticksToFrames(TICKS_PER_SECOND, FRAME_RATES.fps25)).toBe(25);
  });

  it("rejects non-finite seconds", () => {
    expect(() => secondsToTicks(Number.NaN)).toThrow(RangeError);
  });
});

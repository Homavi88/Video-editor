import { describe, expect, it } from "vitest";
import { sampleKeyframes } from "../src/model/keyframe.js";
import { asId } from "../src/util/id.js";
import { secondsToTicks } from "../src/util/time.js";

describe("sampleKeyframes", () => {
  it("returns fallback for empty list", () => {
    expect(sampleKeyframes([], 0n, 42)).toBe(42);
  });

  it("interpolates linearly between keys", () => {
    const keys = [
      {
        id: asId<"Keyframe">("a"),
        time: secondsToTicks(0),
        value: 0,
        interpolation: "linear" as const,
      },
      {
        id: asId<"Keyframe">("b"),
        time: secondsToTicks(2),
        value: 100,
        interpolation: "linear" as const,
      },
    ];
    expect(sampleKeyframes(keys, secondsToTicks(1), 0)).toBe(50);
  });

  it("holds value until next key when interpolation is hold", () => {
    const keys = [
      {
        id: asId<"Keyframe">("a"),
        time: secondsToTicks(0),
        value: 10,
        interpolation: "hold" as const,
      },
      {
        id: asId<"Keyframe">("b"),
        time: secondsToTicks(2),
        value: 90,
        interpolation: "linear" as const,
      },
    ];
    expect(sampleKeyframes(keys, secondsToTicks(1), 0)).toBe(10);
  });
});

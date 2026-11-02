import { describe, expect, it } from "vitest";
import { parseCubeLut, sampleLut3D, serializeCubeLut } from "../src/color/lut.js";

describe("cube LUT", () => {
  it("parses and samples an identity 2³ LUT", () => {
    const lines = ["TITLE \"Identity\"", "LUT_3D_SIZE 2"];
    for (let b = 0; b < 2; b += 1) {
      for (let g = 0; g < 2; g += 1) {
        for (let r = 0; r < 2; r += 1) {
          lines.push(`${r} ${g} ${b}`);
        }
      }
    }
    const lut = parseCubeLut(lines.join("\n"));
    expect(lut.size).toBe(2);
    const [r, g, b] = sampleLut3D(lut, 1, 1, 1);
    expect(r).toBeCloseTo(1);
    expect(g).toBeCloseTo(1);
    expect(b).toBeCloseTo(1);
    const roundTrip = parseCubeLut(serializeCubeLut(lut));
    expect(roundTrip.data.length).toBe(lut.data.length);
  });
});

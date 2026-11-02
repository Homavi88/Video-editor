import { describe, expect, it } from "vitest";
import { createRectMask, createEllipseMask, maskCoverage, pointInMask } from "../src/model/mask.js";

describe("mask coverage", () => {
  it("rect hard edge includes center and excludes outside", () => {
    const mask = createRectMask({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    expect(pointInMask(mask, 0.5, 0.5)).toBe(true);
    expect(pointInMask(mask, 0.05, 0.05)).toBe(false);
    expect(maskCoverage(mask, 0.5, 0.5)).toBe(1);
    expect(maskCoverage(mask, 0.05, 0.05)).toBe(0);
  });

  it("feather softens edges and invert flips coverage", () => {
    const soft = { ...createRectMask({ x: 0.3, y: 0.3, w: 0.4, h: 0.4 }), feather: 80 };
    const edge = maskCoverage(soft, 0.3, 0.5, 100);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
    const inv = { ...soft, inverted: true };
    expect(maskCoverage(inv, 0.5, 0.5)).toBeLessThan(0.5);
  });

  it("ellipse + expansion grow the mask", () => {
    const base = createEllipseMask({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 });
    const grown = { ...base, expansion: 40 };
    expect(maskCoverage(base, 0.25, 0.5, 100)).toBe(0);
    expect(maskCoverage(grown, 0.25, 0.5, 100)).toBeGreaterThan(0);
  });
});

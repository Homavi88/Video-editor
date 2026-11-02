/**
 * Builds a small demo 3D LUT (warm grade) without shipping binary assets.
 */

import type { Lut3D } from "./lut.js";

/** 17³ warm cinematic-ish LUT for preview demos. */
export function createWarmDemoLut(size = 17): Lut3D {
  const data = new Float32Array(size * size * size * 3);
  let i = 0;
  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        const rn = r / (size - 1);
        const gn = g / (size - 1);
        const bn = b / (size - 1);
        // Slight teal-orange: lift reds, cool shadows.
        const rr = Math.min(1, rn * 1.08 + 0.02);
        const gg = Math.min(1, gn * 0.98);
        const bb = Math.min(1, bn * 1.05 + (1 - rn) * 0.03);
        data[i++] = rr;
        data[i++] = gg;
        data[i++] = bb;
      }
    }
  }
  return {
    title: "Lumina Warm Demo",
    size,
    domainMin: [0, 0, 0],
    domainMax: [1, 1, 1],
    data,
  };
}

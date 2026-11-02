/**
 * CPU scopes for Color workspace: waveform, parade, histogram, vectorscope (2D hist).
 * Input is RGBA Uint8Array row-major.
 */

export interface ScopeBuffers {
  readonly waveform: Uint8Array;
  readonly paradeR: Uint8Array;
  readonly paradeG: Uint8Array;
  readonly paradeB: Uint8Array;
  readonly histogram: Uint32Array;
  readonly vectorscope: Uint32Array;
  readonly width: number;
  readonly height: number;
}

/** Computes monitoring scopes from an RGBA frame. */
export function computeScopes(
  rgba: Uint8Array,
  width: number,
  height: number,
  scopeHeight = 256,
): ScopeBuffers {
  const waveform = new Uint8Array(width * scopeHeight);
  const paradeR = new Uint8Array(width * scopeHeight);
  const paradeG = new Uint8Array(width * scopeHeight);
  const paradeB = new Uint8Array(width * scopeHeight);
  const histogram = new Uint32Array(256);
  const vectorscope = new Uint32Array(scopeHeight * scopeHeight);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = rgba[i]!;
      const g = rgba[i + 1]!;
      const b = rgba[i + 2]!;
      const luma = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
      histogram[luma] += 1;

      const wy = scopeHeight - 1 - Math.min(scopeHeight - 1, Math.floor((luma / 255) * (scopeHeight - 1)));
      waveform[wy * width + x] = 255;
      paradeR[(scopeHeight - 1 - Math.floor((r / 255) * (scopeHeight - 1))) * width + x] = 255;
      paradeG[(scopeHeight - 1 - Math.floor((g / 255) * (scopeHeight - 1))) * width + x] = 255;
      paradeB[(scopeHeight - 1 - Math.floor((b / 255) * (scopeHeight - 1))) * width + x] = 255;

      // Approximate U/V style vectorscope
      const u = (b - luma) / 255;
      const v = (r - luma) / 255;
      const vx = Math.min(scopeHeight - 1, Math.max(0, Math.floor((u * 0.5 + 0.5) * (scopeHeight - 1))));
      const vy = Math.min(scopeHeight - 1, Math.max(0, Math.floor((1 - (v * 0.5 + 0.5)) * (scopeHeight - 1))));
      vectorscope[vy * scopeHeight + vx] += 1;
    }
  }

  return { waveform, paradeR, paradeG, paradeB, histogram, vectorscope, width, height: scopeHeight };
}

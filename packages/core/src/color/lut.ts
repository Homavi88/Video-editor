/**
 * Minimal .cube LUT parser (Adobe/Resolve compatible subset).
 * Supports 1D and 3D LUTs with TITLE / DOMAIN_MIN / DOMAIN_MAX / LUT_3D_SIZE.
 */

export interface Lut3D {
  readonly title: string;
  readonly size: number;
  readonly domainMin: readonly [number, number, number];
  readonly domainMax: readonly [number, number, number];
  /** Row-major RGB triplets, length = size³. */
  readonly data: Float32Array;
}

export class LutParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LutParseError";
  }
}

/** Parses a `.cube` file body into a 3D LUT. */
export function parseCubeLut(text: string): Lut3D {
  const lines = text.split(/\r?\n/);
  let title = "Untitled LUT";
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const values: number[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("TITLE")) {
      const m = /TITLE\s+"?(.*?)"?\s*$/.exec(line);
      if (m?.[1]) title = m[1];
      continue;
    }
    if (line.startsWith("DOMAIN_MIN")) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 3) domainMin = [parts[0]!, parts[1]!, parts[2]!];
      continue;
    }
    if (line.startsWith("DOMAIN_MAX")) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 3) domainMax = [parts[0]!, parts[1]!, parts[2]!];
      continue;
    }
    if (line.startsWith("LUT_3D_SIZE")) {
      size = Number(line.split(/\s+/)[1]);
      continue;
    }
    if (line.startsWith("LUT_1D_SIZE")) {
      throw new LutParseError("1D LUTs are not supported yet; convert to 3D .cube");
    }
    const nums = line.split(/\s+/).map(Number);
    if (nums.length >= 3 && nums.every((n) => Number.isFinite(n))) {
      values.push(nums[0]!, nums[1]!, nums[2]!);
    }
  }

  if (!Number.isInteger(size) || size < 2) {
    throw new LutParseError("missing or invalid LUT_3D_SIZE");
  }
  const expected = size * size * size * 3;
  if (values.length < expected) {
    throw new LutParseError(`expected ${expected} floats, got ${values.length}`);
  }

  return {
    title,
    size,
    domainMin,
    domainMax,
    data: Float32Array.from(values.slice(0, expected)),
  };
}

/** Samples a 3D LUT with trilinear interpolation. Inputs are in domain space. */
export function sampleLut3D(
  lut: Lut3D,
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const n = lut.size;
  const nr = normalize(r, lut.domainMin[0], lut.domainMax[0]) * (n - 1);
  const ng = normalize(g, lut.domainMin[1], lut.domainMax[1]) * (n - 1);
  const nb = normalize(b, lut.domainMin[2], lut.domainMax[2]) * (n - 1);

  const r0 = Math.floor(nr);
  const g0 = Math.floor(ng);
  const b0 = Math.floor(nb);
  const r1 = Math.min(r0 + 1, n - 1);
  const g1 = Math.min(g0 + 1, n - 1);
  const b1 = Math.min(b0 + 1, n - 1);
  const fr = nr - r0;
  const fg = ng - g0;
  const fb = nb - b0;

  const c000 = texel(lut, r0, g0, b0);
  const c100 = texel(lut, r1, g0, b0);
  const c010 = texel(lut, r0, g1, b0);
  const c110 = texel(lut, r1, g1, b0);
  const c001 = texel(lut, r0, g0, b1);
  const c101 = texel(lut, r1, g0, b1);
  const c011 = texel(lut, r0, g1, b1);
  const c111 = texel(lut, r1, g1, b1);

  const c00 = lerp3(c000, c100, fr);
  const c10 = lerp3(c010, c110, fr);
  const c01 = lerp3(c001, c101, fr);
  const c11 = lerp3(c011, c111, fr);
  const c0 = lerp3(c00, c10, fg);
  const c1 = lerp3(c01, c11, fg);
  return lerp3(c0, c1, fb);
}

function normalize(v: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.min(1, Math.max(0, (v - min) / (max - min)));
}

function texel(lut: Lut3D, r: number, g: number, b: number): [number, number, number] {
  const n = lut.size;
  const idx = (b * n * n + g * n + r) * 3;
  return [lut.data[idx]!, lut.data[idx + 1]!, lut.data[idx + 2]!];
}

function lerp3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Serializes a LUT back to `.cube` text. */
export function serializeCubeLut(lut: Lut3D): string {
  const lines: string[] = [
    `TITLE "${lut.title}"`,
    `DOMAIN_MIN ${lut.domainMin.join(" ")}`,
    `DOMAIN_MAX ${lut.domainMax.join(" ")}`,
    `LUT_3D_SIZE ${lut.size}`,
  ];
  for (let i = 0; i < lut.data.length; i += 3) {
    lines.push(`${lut.data[i]} ${lut.data[i + 1]} ${lut.data[i + 2]}`);
  }
  return `${lines.join("\n")}\n`;
}

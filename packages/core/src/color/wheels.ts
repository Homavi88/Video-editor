/**
 * Lift / Gamma / Gain color wheels math used by the Color workspace.
 * Operates in linear-ish RGB; display conversion is the renderer's job.
 */

export interface ColorWheel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** Master offset applied equally (−1..1 typical). */
  readonly master: number;
}

export interface LiftGammaGain {
  readonly lift: ColorWheel;
  readonly gamma: ColorWheel;
  readonly gain: ColorWheel;
}

export const IDENTITY_LGG: LiftGammaGain = {
  lift: { r: 0, g: 0, b: 0, master: 0 },
  gamma: { r: 0, g: 0, b: 0, master: 0 },
  gain: { r: 0, g: 0, b: 0, master: 0 },
};

/** Applies Lift/Gamma/Gain to a single RGB sample (0..1). */
export function applyLiftGammaGain(
  r: number,
  g: number,
  b: number,
  lgg: LiftGammaGain,
): [number, number, number] {
  const liftR = lgg.lift.r + lgg.lift.master;
  const liftG = lgg.lift.g + lgg.lift.master;
  const liftB = lgg.lift.b + lgg.lift.master;
  const gainR = 1 + lgg.gain.r + lgg.gain.master;
  const gainG = 1 + lgg.gain.g + lgg.gain.master;
  const gainB = 1 + lgg.gain.b + lgg.gain.master;
  const gammaR = gammaExp(lgg.gamma.r + lgg.gamma.master);
  const gammaG = gammaExp(lgg.gamma.g + lgg.gamma.master);
  const gammaB = gammaExp(lgg.gamma.b + lgg.gamma.master);

  return [
    clamp01(Math.pow(Math.max(0, r * gainR + liftR), gammaR)),
    clamp01(Math.pow(Math.max(0, g * gainG + liftG), gammaG)),
    clamp01(Math.pow(Math.max(0, b * gainB + liftB), gammaB)),
  ];
}

function gammaExp(offset: number): number {
  // offset 0 → 1; positive raises mids, negative lowers
  return Math.pow(2, -offset);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Soft-clip exposure utility (EV stops). */
export function applyExposure(r: number, g: number, b: number, stops: number): [number, number, number] {
  const m = Math.pow(2, stops);
  return [clamp01(r * m), clamp01(g * m), clamp01(b * m)];
}

/** Saturation around Rec.709 luma. */
export function applySaturation(
  r: number,
  g: number,
  b: number,
  amount: number,
): [number, number, number] {
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [
    clamp01(y + (r - y) * amount),
    clamp01(y + (g - y) * amount),
    clamp01(y + (b - y) * amount),
  ];
}

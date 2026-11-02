import type { KeyframeId } from "../util/id.js";
import type { TimeTicks } from "../util/time.js";
import type { KeyframeInterpolation } from "./enums.js";

/**
 * A single animated sample on a parameter curve.
 * `value` is typed as `unknown` at the schema boundary; parameter descriptors
 * narrow it at the effect / property level.
 */
export interface Keyframe<T = number> {
  readonly id: KeyframeId;
  /** Time relative to the owning clip's timeline start. */
  readonly time: TimeTicks;
  readonly value: T;
  readonly interpolation: KeyframeInterpolation;
  /**
   * Optional Bezier control: outgoing tangent (normalized 0..1 time / value delta).
   * Ignored unless `interpolation` is `"bezier"`.
   */
  readonly outTangent?: { readonly x: number; readonly y: number };
  /** Optional Bezier control: incoming tangent for the next segment. */
  readonly inTangent?: { readonly x: number; readonly y: number };
}

/**
 * Samples a sorted keyframe list at `time` using the segment's interpolation.
 * Returns `fallback` when the list is empty.
 */
export function sampleKeyframes(
  keyframes: readonly Keyframe<number>[],
  time: TimeTicks,
  fallback: number,
): number {
  if (keyframes.length === 0) return fallback;
  const sorted = [...keyframes].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  if (time <= sorted[0]!.time) return sorted[0]!.value;
  const last = sorted[sorted.length - 1]!;
  if (time >= last.time) return last.value;

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (time >= a.time && time <= b.time) {
      return interpolateSegment(a, b, time);
    }
  }
  return last.value;
}

function interpolateSegment(a: Keyframe<number>, b: Keyframe<number>, time: TimeTicks): number {
  const span = Number(b.time - a.time);
  if (span <= 0) return b.value;
  const t = Number(time - a.time) / span;

  switch (a.interpolation) {
    case "hold":
      return a.value;
    case "linear":
      return a.value + (b.value - a.value) * t;
    case "easeIn":
      return a.value + (b.value - a.value) * (t * t);
    case "easeOut": {
      const u = 1 - (1 - t) * (1 - t);
      return a.value + (b.value - a.value) * u;
    }
    case "easeInOut": {
      const u = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      return a.value + (b.value - a.value) * u;
    }
    case "bezier": {
      const outX = a.outTangent?.x ?? 0.42;
      const outY = a.outTangent?.y ?? 0;
      const inX = a.inTangent?.x ?? 0.58;
      const inY = a.inTangent?.y ?? 1;
      const u = cubicBezierApprox(t, outX, outY, inX, inY);
      return a.value + (b.value - a.value) * u;
    }
    default: {
      const _exhaustive: never = a.interpolation;
      return _exhaustive;
    }
  }
}

/**
 * Approximates a unit cubic Bezier Y at parameter `t` where control points are
 * (0,0), (x1,y1), (x2,y2), (1,1). Sufficient for UI animation curves.
 */
function cubicBezierApprox(t: number, x1: number, y1: number, x2: number, y2: number): number {
  // Solve for u such that bezierX(u) ≈ t, then evaluate bezierY(u).
  let u = t;
  for (let i = 0; i < 5; i += 1) {
    const x = bezier1d(u, x1, x2) - t;
    const dx = bezier1dDerivative(u, x1, x2);
    if (Math.abs(dx) < 1e-6) break;
    u -= x / dx;
    u = Math.min(1, Math.max(0, u));
  }
  return bezier1d(u, y1, y2);
}

function bezier1d(t: number, c1: number, c2: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * t * c1 + 3 * mt * t * t * c2 + t * t * t;
}

function bezier1dDerivative(t: number, c1: number, c2: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * c1 + 6 * mt * t * (c2 - c1) + 3 * t * t * (1 - c2);
}

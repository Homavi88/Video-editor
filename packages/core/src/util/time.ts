/**
 * Time is stored in rational ticks so that edits remain exact across fps changes.
 * One second = {@link TICKS_PER_SECOND} ticks (default 254016000000 — divisible by
 * 24, 25, 30, 50, 60, 120 and common drop-frame rates).
 */

/** Canonical tick rate used by Lumina project files. */
export const TICKS_PER_SECOND = 254_016_000_000n;

/** Discrete timeline position / duration measured in ticks. */
export type TimeTicks = bigint;

/** Frames-per-second as a rational number (e.g. 24000/1001 for 23.976). */
export interface RationalRate {
  readonly numerator: number;
  readonly denominator: number;
}

/** Common frame rates used by sequences and media. */
export const FRAME_RATES = {
  fps23_976: { numerator: 24000, denominator: 1001 } satisfies RationalRate,
  fps24: { numerator: 24, denominator: 1 } satisfies RationalRate,
  fps25: { numerator: 25, denominator: 1 } satisfies RationalRate,
  fps29_97: { numerator: 30000, denominator: 1001 } satisfies RationalRate,
  fps30: { numerator: 30, denominator: 1 } satisfies RationalRate,
  fps50: { numerator: 50, denominator: 1 } satisfies RationalRate,
  fps59_94: { numerator: 60000, denominator: 1001 } satisfies RationalRate,
  fps60: { numerator: 60, denominator: 1 } satisfies RationalRate,
} as const;

/** Converts seconds (number) to ticks. Fractional seconds are truncated toward zero. */
export function secondsToTicks(seconds: number): TimeTicks {
  if (!Number.isFinite(seconds)) {
    throw new RangeError(`seconds must be finite, got ${seconds}`);
  }
  return BigInt(Math.trunc(seconds * Number(TICKS_PER_SECOND)));
}

/** Converts ticks to floating-point seconds (lossy for UI display). */
export function ticksToSeconds(ticks: TimeTicks): number {
  return Number(ticks) / Number(TICKS_PER_SECOND);
}

/** Duration of one frame at the given rate, in ticks. */
export function frameDurationTicks(rate: RationalRate): TimeTicks {
  if (rate.numerator <= 0 || rate.denominator <= 0) {
    throw new RangeError("frame rate parts must be positive");
  }
  return (TICKS_PER_SECOND * BigInt(rate.denominator)) / BigInt(rate.numerator);
}

/** Converts a frame index to ticks at the given rate. */
export function framesToTicks(frames: number, rate: RationalRate): TimeTicks {
  if (!Number.isInteger(frames)) {
    throw new RangeError("frames must be an integer");
  }
  return frameDurationTicks(rate) * BigInt(frames);
}

/** Converts ticks to the nearest frame index (floor) at the given rate. */
export function ticksToFrames(ticks: TimeTicks, rate: RationalRate): number {
  const perFrame = frameDurationTicks(rate);
  return Number(ticks / perFrame);
}

/** Clamps ticks into `[min, max]`. */
export function clampTicks(value: TimeTicks, min: TimeTicks, max: TimeTicks): TimeTicks {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Returns the maximum of two tick values. */
export function maxTicks(a: TimeTicks, b: TimeTicks): TimeTicks {
  return a >= b ? a : b;
}

/** Returns the minimum of two tick values. */
export function minTicks(a: TimeTicks, b: TimeTicks): TimeTicks {
  return a <= b ? a : b;
}

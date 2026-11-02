/**
 * Clip-level audio volume automation (rubber-band style keyframes).
 */

import type { TimeTicks } from "../util/time.js";
import { sampleKeyframes, type Keyframe } from "../model/keyframe.js";
import { createId } from "../util/id.js";

export interface VolumePoint {
  readonly time: TimeTicks;
  /** Linear gain 0..1+ (1 = unity). */
  readonly gain: number;
}

/** Builds keyframes from volume points. */
export function volumeKeyframes(points: readonly VolumePoint[]): Keyframe<number>[] {
  return points.map((p) => ({
    id: createId<"Keyframe">(),
    time: p.time,
    value: p.gain,
    interpolation: "bezier" as const,
    outTangent: { x: 0.42, y: 0 },
    inTangent: { x: 0.58, y: 1 },
  }));
}

/** Samples volume automation; defaults to unity. */
export function sampleVolume(keyframes: readonly Keyframe<number>[], time: TimeTicks): number {
  return sampleKeyframes(keyframes, time, 1);
}

/**
 * Simple audio ducking: attenuates music gain when speech envelope exceeds threshold.
 * `speech` / `music` are parallel gain envelopes sampled at the same times.
 */
export function duckMusicGain(
  musicGain: number,
  speechLevel: number,
  options: { threshold?: number; reduction?: number; softness?: number } = {},
): number {
  const threshold = options.threshold ?? 0.15;
  const reduction = options.reduction ?? 0.25;
  const softness = options.softness ?? 0.1;
  if (speechLevel <= threshold) return musicGain;
  const over = Math.min(1, (speechLevel - threshold) / Math.max(softness, 1e-6));
  return musicGain * (1 - over * (1 - reduction));
}

/** Converts dB to linear gain. */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/** Converts linear gain to dB. */
export function gainToDb(gain: number): number {
  if (gain <= 1e-8) return -96;
  return 20 * Math.log10(gain);
}

/** True-peak-ish limiter (sample soft clip). */
export function softLimit(sample: number, ceiling = 0.99): number {
  const x = sample / ceiling;
  const limited = x / (1 + Math.abs(x));
  return limited * ceiling;
}

/** RMS of a PCM buffer (mono interleaved Float32). */
export function rmsLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i]!;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Silence detection: returns ranges [startSample, endSample) where abs peak
 * stays below threshold for at least `minSamples`.
 */
export function detectSilence(
  samples: Float32Array,
  options: { threshold?: number; minSamples?: number } = {},
): Array<{ start: number; end: number }> {
  const threshold = options.threshold ?? 0.01;
  const minSamples = options.minSamples ?? 4800;
  const ranges: Array<{ start: number; end: number }> = [];
  let runStart = -1;
  for (let i = 0; i < samples.length; i += 1) {
    const silent = Math.abs(samples[i]!) < threshold;
    if (silent && runStart < 0) runStart = i;
    if ((!silent || i === samples.length - 1) && runStart >= 0) {
      const end = silent && i === samples.length - 1 ? samples.length : i;
      if (end - runStart >= minSamples) ranges.push({ start: runStart, end });
      runStart = -1;
    }
  }
  return ranges;
}

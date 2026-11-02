/**
 * AI module contracts. Heavy models (Whisper, segmentation) run out-of-process;
 * this package defines job types and pure helpers (scene detection on frame diffs).
 */

import type { TimeTicks } from "@lumina/core";

export * from "./transcription.js";
// Node-only Whisper CLI lives in `@lumina/ai/whisper` — do not re-export here
// or Vite will try to bundle `node:child_process` into the renderer.

export interface SceneCut {
  readonly time: TimeTicks;
  readonly score: number;
}

/**
 * Detects scene cuts from a sequence of greyscale mean luma samples (0..1),
 * one per frame. Pure CPU heuristic for Stage 10; replaceable by native CV.
 */
export function detectScenesFromLuma(
  frameLuma: readonly number[],
  frameDurationTicks: TimeTicks,
  threshold = 0.28,
): SceneCut[] {
  const cuts: SceneCut[] = [];
  for (let i = 1; i < frameLuma.length; i += 1) {
    const delta = Math.abs(frameLuma[i]! - frameLuma[i - 1]!);
    if (delta >= threshold) {
      cuts.push({ time: frameDurationTicks * BigInt(i), score: delta });
    }
  }
  return cuts;
}

export interface ReframeBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Computes a vertical 9:16 crop window tracking a subject point in normalized coords.
 */
export function autoReframe9x16(
  subjectX: number,
  subjectY: number,
  sourceAspect = 16 / 9,
): ReframeBox {
  const targetAspect = 9 / 16;
  const frameH = 1 / sourceAspect;
  const cropW = frameH * targetAspect;
  const x = clamp(subjectX - cropW / 2, 0, Math.max(0, 1 - cropW));
  const y = clamp(subjectY - frameH / 2, 0, 0);
  return { x, y, width: cropW, height: frameH };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

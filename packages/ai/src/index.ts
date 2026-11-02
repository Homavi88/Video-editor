/**
 * AI module contracts. Heavy models (Whisper, segmentation) run out-of-process;
 * this package defines job types and pure helpers (scene detection on frame diffs).
 */

import { createId, type TimeTicks, parseSrt, type SubtitleCue } from "@lumina/core";

export type AiProvider = "local-whisper" | "openai-compatible" | "none";

export interface TranscriptionJob {
  readonly id: string;
  readonly mediaPath: string;
  readonly language: string | "auto";
  readonly provider: AiProvider;
  readonly status: "queued" | "running" | "completed" | "failed";
  readonly progress: number;
  readonly resultSrt: string | null;
  readonly error: string | null;
}

export function createTranscriptionJob(
  mediaPath: string,
  provider: AiProvider = "local-whisper",
  language: string | "auto" = "auto",
): TranscriptionJob {
  return {
    id: createId(),
    mediaPath,
    language,
    provider,
    status: "queued",
    progress: 0,
    resultSrt: null,
    error: null,
  };
}

/** Converts a completed transcription SRT into subtitle cues. */
export function transcriptionToCues(job: TranscriptionJob): SubtitleCue[] {
  if (!job.resultSrt) return [];
  return parseSrt(job.resultSrt);
}

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
  // Source assumed width=1, height=1/sourceAspect in normalized width space.
  const frameH = 1 / sourceAspect;
  const cropW = frameH * targetAspect;
  const x = clamp(subjectX - cropW / 2, 0, Math.max(0, 1 - cropW));
  const y = clamp(subjectY - frameH / 2, 0, 0);
  return { x, y, width: cropW, height: frameH };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Demo SRT used when Whisper binary is not installed — still a valid pipeline. */
export function demoTranscriptSrt(durationSeconds = 8): string {
  const mid = Math.max(1, Math.floor(durationSeconds / 2));
  return [
    "1",
    `00:00:00,000 --> 00:00:${String(mid).padStart(2, "0")},000`,
    "Lumina auto-captions (demo provider)",
    "",
    "2",
    `00:00:${String(mid).padStart(2, "0")},000 --> 00:00:${String(durationSeconds).padStart(2, "0")},000`,
    "Replace with local Whisper for production STT.",
    "",
  ].join("\n");
}

/** Completes a job synchronously with the demo transcript (offline-friendly). */
export function runDemoTranscription(job: TranscriptionJob, durationSeconds = 8): TranscriptionJob {
  return {
    ...job,
    status: "completed",
    progress: 1,
    resultSrt: demoTranscriptSrt(durationSeconds),
    error: null,
  };
}

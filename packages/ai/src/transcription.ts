import { createId, parseSrt, type SubtitleCue } from "@lumina/core";

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

export function transcriptionToCues(job: TranscriptionJob): SubtitleCue[] {
  if (!job.resultSrt) return [];
  return parseSrt(job.resultSrt);
}

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

export function runDemoTranscription(
  job: TranscriptionJob,
  durationSeconds = 8,
): TranscriptionJob {
  return {
    ...job,
    status: "completed",
    progress: 1,
    resultSrt: demoTranscriptSrt(durationSeconds),
    error: null,
  };
}

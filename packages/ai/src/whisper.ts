/**
 * Local Whisper CLI integration. Uses `whisper` when present; otherwise
 * falls back to the demo transcript provider.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  createTranscriptionJob,
  runDemoTranscription,
  type TranscriptionJob,
} from "./transcription.js";

export interface WhisperOptions {
  readonly language?: string;
  readonly model?: string;
  readonly binary?: string;
  readonly workDir?: string;
}

/** Returns true when a whisper-compatible binary is on PATH. */
export async function isWhisperAvailable(binary = "whisper"): Promise<boolean> {
  return await new Promise((resolve) => {
    const child = spawn(binary, ["--help"], { stdio: ["ignore", "ignore", "ignore"] });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0 || code === 1 || code === 2));
  });
}

/**
 * Runs Whisper CLI on `mediaPath`. Falls back to demo captions when missing.
 */
export async function transcribeWithWhisper(
  mediaPath: string,
  options: WhisperOptions = {},
): Promise<TranscriptionJob> {
  const job = createTranscriptionJob(mediaPath, "local-whisper", options.language ?? "auto");
  const binary = options.binary ?? "whisper";
  const available = await isWhisperAvailable(binary);
  if (!available) {
    return runDemoTranscription({ ...job, provider: "none" });
  }

  const workDir = options.workDir ?? path.join(path.dirname(mediaPath), ".lumina-whisper");
  await fs.mkdir(workDir, { recursive: true });

  const args = [
    mediaPath,
    "--model",
    options.model ?? "base",
    "--output_format",
    "srt",
    "--output_dir",
    workDir,
  ];
  if (options.language && options.language !== "auto") {
    args.push("--language", options.language);
  }

  try {
    await run(binary, args);
    const alt = path.join(workDir, `${path.basename(mediaPath, path.extname(mediaPath))}.srt`);
    const srt = await fs.readFile(alt, "utf8");
    return {
      ...job,
      status: "completed",
      progress: 1,
      resultSrt: srt,
      error: null,
    };
  } catch (err) {
    return {
      ...runDemoTranscription(job),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    // Drain stdout so a chatty Whisper build cannot fill the pipe and deadlock.
    child.stdout?.on("data", () => undefined);
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr || `${bin} exited ${code}`));
      else resolve();
    });
  });
}

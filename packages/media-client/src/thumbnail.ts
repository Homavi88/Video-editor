/**
 * Thumbnail / filmstrip extraction via ffmpeg.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

/** Writes a single JPEG poster frame near `timeSeconds`. */
export async function extractPosterFrame(
  inputPath: string,
  outputPath: string,
  timeSeconds = 1,
  ffmpegBin = "ffmpeg",
): Promise<string> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await runFfmpeg([
    "-y",
    "-ss",
    String(Math.max(0, timeSeconds)),
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    outputPath,
  ], ffmpegBin);
  return outputPath;
}

function runFfmpeg(args: string[], bin: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr || `ffmpeg exited ${code}`));
      else resolve();
    });
  });
}

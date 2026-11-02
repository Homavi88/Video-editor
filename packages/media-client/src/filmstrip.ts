/**
 * Filmstrip / contact-sheet generation for timeline clip thumbnails.
 */

import path from "node:path";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { extractFramePng, runFfmpeg } from "./frame.js";

export interface FilmstripOptions {
  readonly frames?: number;
  readonly thumbWidth?: number;
  readonly thumbHeight?: number;
  readonly durationSeconds: number;
  readonly ffmpegBin?: string;
}

/** Writes N evenly spaced PNG thumbs and returns their paths. */
export async function generateFilmstrip(
  inputPath: string,
  cacheDir: string,
  options: FilmstripOptions,
): Promise<string[]> {
  const frames = Math.max(1, options.frames ?? 8);
  const w = options.thumbWidth ?? 160;
  const h = options.thumbHeight ?? 90;
  await fs.mkdir(cacheDir, { recursive: true });
  const key = createHash("sha1")
    .update(`${inputPath}|${frames}|${w}x${h}|${options.durationSeconds}`)
    .digest("hex")
    .slice(0, 12);
  const out: string[] = [];
  for (let i = 0; i < frames; i += 1) {
    const t =
      options.durationSeconds <= 0
        ? 0
        : (i + 0.5) * (options.durationSeconds / frames);
    const file = path.join(cacheDir, `strip-${key}-${i}.png`);
    try {
      await fs.access(file);
      out.push(file);
      continue;
    } catch {
      // generate
    }
    const png = await extractFramePng(inputPath, {
      timeSeconds: t,
      width: w,
      height: h,
      ...(options.ffmpegBin !== undefined ? { ffmpegBin: options.ffmpegBin } : {}),
    });
    await fs.writeFile(file, png);
    out.push(file);
  }
  return out;
}

/** Builds a single horizontal contact sheet PNG via ffmpeg tile filter. */
export async function generateContactSheet(
  inputPath: string,
  outputPath: string,
  columns = 8,
  durationSeconds = 8,
  ffmpegBin = "ffmpeg",
): Promise<string> {
  const fps = columns / Math.max(durationSeconds, 0.1);
  await runFfmpeg(
    [
      "-y",
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-vf",
      `fps=${fps.toFixed(4)},scale=160:90,tile=${columns}x1`,
      outputPath,
    ],
    ffmpegBin,
  );
  return outputPath;
}

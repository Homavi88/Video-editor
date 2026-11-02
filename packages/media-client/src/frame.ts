/**
 * Frame extraction for Program/Source monitors via ffmpeg.
 * Returns PNG bytes (browser-friendly) or writes to a cache path.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export interface ExtractFrameOptions {
  readonly timeSeconds: number;
  readonly width?: number;
  readonly height?: number;
  readonly ffmpegBin?: string;
}

/** Extracts a single PNG frame at `timeSeconds` into a Buffer. */
export async function extractFramePng(
  inputPath: string,
  options: ExtractFrameOptions,
): Promise<Buffer> {
  const ffmpeg = options.ffmpegBin ?? "ffmpeg";
  const args = [
    "-v",
    "error",
    "-ss",
    String(Math.max(0, options.timeSeconds)),
    "-i",
    inputPath,
    "-frames:v",
    "1",
  ];
  if (options.width && options.height) {
    args.push("-vf", `scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease,pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2`);
  }
  args.push("-f", "image2pipe", "-vcodec", "png", "pipe:1");

  return await runToBuffer(ffmpeg, args);
}

/** Cache-aware frame extract: writes under `cacheDir` and returns the file path. */
export async function extractFrameCached(
  inputPath: string,
  cacheDir: string,
  options: ExtractFrameOptions,
): Promise<string> {
  await fs.mkdir(cacheDir, { recursive: true });
  const key = createHash("sha1")
    .update(
      `${inputPath}|${options.timeSeconds.toFixed(3)}|${options.width ?? 0}x${options.height ?? 0}`,
    )
    .digest("hex")
    .slice(0, 16);
  const out = path.join(cacheDir, `frame-${key}.png`);
  try {
    await fs.access(out);
    return out;
  } catch {
    // continue
  }
  const buf = await extractFramePng(inputPath, options);
  await fs.writeFile(out, buf);
  return out;
}

/**
 * Builds a proxy file next to the original (or into cacheDir) for realtime editing.
 */
export async function generateProxyFile(
  inputPath: string,
  outputPath: string,
  ffmpegBin = "ffmpeg",
): Promise<string> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await runFfmpeg(
    [
      "-y",
      "-i",
      inputPath,
      "-vf",
      "scale=1280:-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      outputPath,
    ],
    ffmpegBin,
  );
  return outputPath;
}

/** Runs ffmpeg writing to `outputPath` (no stdout capture). */
export async function runFfmpeg(args: string[], ffmpegBin = "ffmpeg"): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegBin, args, { stdio: ["ignore", "ignore", "pipe"] });
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

function runToBuffer(bin: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr || `${bin} exited ${code}`));
      else resolve(Buffer.concat(chunks));
    });
  });
}

/** Generates a short demo MP4 (color bars + sine) for offline UI testing. */
export async function generateDemoMedia(
  outputDir: string,
  ffmpegBin = "ffmpeg",
): Promise<{ video: string; audio: string; image: string }> {
  await fs.mkdir(outputDir, { recursive: true });
  const video = path.join(outputDir, "demo-bars.mp4");
  const audio = path.join(outputDir, "demo-tone.wav");
  const image = path.join(outputDir, "demo-gradient.png");

  await runFfmpeg(
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "smptebars=size=1280x720:rate=25",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=48000",
      "-t",
      "8",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      video,
    ],
    ffmpegBin,
  );
  await runFfmpeg(
    ["-y", "-f", "lavfi", "-i", "sine=frequency=220:duration=8", audio],
    ffmpegBin,
  );
  await runFfmpeg(
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=1280x720:rate=1",
      "-frames:v",
      "1",
      image,
    ],
    ffmpegBin,
  );
  return { video, audio, image };
}

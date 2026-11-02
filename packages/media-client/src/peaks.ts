/**
 * Audio peak pyramid extraction via ffmpeg `astats`/`aresample` PCM dump.
 * For Stage 8 waveform drawing on the timeline.
 */

import { spawn } from "node:child_process";

export interface PeakPyramid {
  readonly sampleRate: number;
  /** Min/max pairs per bucket at the finest level. */
  readonly peaks: Float32Array;
  readonly buckets: number;
}

/** Extracts mono peak envelopes by decoding to f32le and bucketing. */
export async function extractPeaks(
  filePath: string,
  options: { buckets?: number; ffmpegBin?: string } = {},
): Promise<PeakPyramid> {
  const buckets = options.buckets ?? 2048;
  const ffmpeg = options.ffmpegBin ?? "ffmpeg";
  const pcm = await decodeMonoF32(filePath, ffmpeg);
  const peaks = new Float32Array(buckets * 2);
  const bucketSize = Math.max(1, Math.floor(pcm.length / buckets));
  for (let b = 0; b < buckets; b += 1) {
    const start = b * bucketSize;
    const end = Math.min(pcm.length, start + bucketSize);
    let min = 0;
    let max = 0;
    for (let i = start; i < end; i += 1) {
      const v = pcm[i]!;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    peaks[b * 2] = min;
    peaks[b * 2 + 1] = max;
  }
  return { sampleRate: 48000, peaks, buckets };
}

function decodeMonoF32(filePath: string, ffmpeg: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "error",
      "-i",
      filePath,
      "-ac",
      "1",
      "-ar",
      "48000",
      "-f",
      "f32le",
      "pipe:1",
    ];
    const child = spawn(ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `ffmpeg exited ${code}`));
        return;
      }
      const buf = Buffer.concat(chunks);
      resolve(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4));
    });
  });
}

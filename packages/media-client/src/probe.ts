/**
 * Media probe via ffprobe (LGPL FFmpeg). Falls back to extension heuristics
 * when ffprobe is unavailable (browser / CI without binary).
 */

import { spawn } from "node:child_process";
import path from "node:path";
import {
  FRAME_RATES,
  secondsToTicks,
  type MediaKind,
  type MediaMetadata,
  type RationalRate,
  type ColorSpace,
} from "@lumina/core";

export interface ProbeResult {
  readonly metadata: MediaMetadata;
  readonly kind: MediaKind;
}

/** Probes a local media file with ffprobe JSON output. */
export async function probeFile(filePath: string, ffprobeBin = "ffprobe"): Promise<ProbeResult> {
  try {
    const json = await runFfprobe(filePath, ffprobeBin);
    return parseFfprobeJson(json, filePath);
  } catch (err) {
    return heuristicProbe(filePath, err);
  }
}

function runFfprobe(filePath: string, bin: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      filePath,
    ];
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `ffprobe exited ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as unknown);
      } catch (e) {
        reject(e);
      }
    });
  });
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  channels?: number;
  sample_rate?: string;
  pix_fmt?: string;
  color_space?: string;
  duration?: string;
  bit_rate?: string;
  tags?: Record<string, string>;
}

interface FfprobeFormat {
  duration?: string;
  bit_rate?: string;
  format_name?: string;
  tags?: Record<string, string>;
}

function parseFfprobeJson(raw: unknown, filePath: string): ProbeResult {
  const doc = raw as { streams?: FfprobeStream[]; format?: FfprobeFormat };
  const streams = doc.streams ?? [];
  const format = doc.format ?? {};
  const video = streams.find((s) => s.codec_type === "video");
  const audio = streams.find((s) => s.codec_type === "audio");
  const durationSec = Number(format.duration ?? video?.duration ?? audio?.duration ?? 0);
  const frameRate = parseRate(video?.avg_frame_rate || video?.r_frame_rate);
  const kind = inferKind(filePath, Boolean(video), Boolean(audio));
  const colorSpace = mapColorSpace(video?.color_space);
  const startTimecode = video?.tags?.timecode || format.tags?.timecode;

  const metadata: MediaMetadata = {
    duration: secondsToTicks(Number.isFinite(durationSec) ? durationSec : 0),
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    ...(video?.width !== undefined ? { width: video.width } : {}),
    ...(video?.height !== undefined ? { height: video.height } : {}),
    ...(frameRate ? { frameRate } : {}),
    ...(video?.codec_name ? { videoCodec: video.codec_name } : {}),
    ...(audio?.codec_name ? { audioCodec: audio.codec_name } : {}),
    ...(audio?.channels !== undefined ? { audioChannels: audio.channels } : {}),
    ...(audio?.sample_rate ? { audioSampleRate: Number(audio.sample_rate) } : {}),
    ...(format.bit_rate ? { bitRate: Number(format.bit_rate) } : {}),
    ...(video?.pix_fmt ? { pixelFormat: video.pix_fmt } : {}),
    ...(colorSpace !== undefined ? { colorSpace } : {}),
    ...(startTimecode !== undefined ? { startTimecode } : {}),
  };

  return { metadata, kind };
}

function parseRate(value: string | undefined): RationalRate | undefined {
  if (!value || value === "0/0") return undefined;
  const [n, d] = value.split("/").map(Number);
  if (!n || !d) return undefined;
  // Snap to known rates when close
  const fps = n / d;
  for (const rate of Object.values(FRAME_RATES)) {
    if (Math.abs(rate.numerator / rate.denominator - fps) < 0.01) return rate;
  }
  return { numerator: n, denominator: d };
}

function mapColorSpace(value: string | undefined): ColorSpace | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (v.includes("bt709") || v.includes("rec709")) return "rec709";
  if (v.includes("bt2020") || v.includes("rec2020")) return "rec2020";
  if (v.includes("smpte432") || v.includes("display-p3")) return "displayP3";
  return "srgb";
}

function inferKind(filePath: string, hasVideo: boolean, hasAudio: boolean): MediaKind {
  const ext = path.extname(filePath).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".psd", ".exr", ".tif", ".tiff"].includes(ext)) {
    return "image";
  }
  if ([".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg"].includes(ext)) return "audio";
  if (hasVideo) return "video";
  if (hasAudio) return "audio";
  return "video";
}

function heuristicProbe(filePath: string, _cause: unknown): ProbeResult {
  const kind = inferKind(filePath, true, false);
  const clean: MediaMetadata = {
    duration: secondsToTicks(kind === "image" ? 5 : 10),
    hasVideo: kind !== "audio",
    hasAudio: kind !== "image",
    ...(kind !== "audio" ? { width: 1920, height: 1080, frameRate: FRAME_RATES.fps25 } : {}),
    ...(kind !== "image" ? { audioChannels: 2, audioSampleRate: 48000 } : {}),
  };
  return { metadata: clean, kind };
}

/**
 * Builds an ffmpeg command to generate a low-res proxy (1280-wide H.264).
 */
export function buildProxyArgs(inputPath: string, outputPath: string): string[] {
  return [
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
  ];
}

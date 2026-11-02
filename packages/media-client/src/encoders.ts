/**
 * Detects available hardware encoders via `ffmpeg -encoders` plus a smoke probe.
 */

import { spawn } from "node:child_process";

export type HwEncoderId = "nvenc" | "qsv" | "amf" | "videotoolbox" | "software";

export interface EncoderInfo {
  readonly id: HwEncoderId;
  readonly videoCodecFlag: string;
  readonly label: string;
  readonly available: boolean;
}

const CANDIDATES: Array<{ id: HwEncoderId; match: RegExp; flag: string; label: string }> = [
  { id: "nvenc", match: /h264_nvenc/, flag: "h264_nvenc", label: "NVIDIA NVENC" },
  { id: "qsv", match: /h264_qsv/, flag: "h264_qsv", label: "Intel Quick Sync" },
  { id: "amf", match: /h264_amf/, flag: "h264_amf", label: "AMD AMF" },
  {
    id: "videotoolbox",
    match: /h264_videotoolbox/,
    flag: "h264_videotoolbox",
    label: "Apple VideoToolbox",
  },
];

/** Lists HW H.264 encoders that both appear in ffmpeg and pass a 1-frame probe. */
export async function detectEncoders(ffmpegBin = "ffmpeg"): Promise<EncoderInfo[]> {
  const listing = await runText(ffmpegBin, ["-hide_banner", "-encoders"]);
  const found: EncoderInfo[] = [];
  for (const c of CANDIDATES) {
    const listed = c.match.test(listing);
    const available = listed ? await probeEncoder(ffmpegBin, c.flag) : false;
    found.push({
      id: c.id,
      videoCodecFlag: c.flag,
      label: c.label,
      available,
    });
  }
  found.push({
    id: "software",
    videoCodecFlag: "libx264",
    label: "Software (libx264)",
    available: true,
  });
  return found;
}

/** Picks the first available preferred encoder, else software. */
export function pickEncoder(
  encoders: readonly EncoderInfo[],
  prefer: readonly HwEncoderId[] = ["nvenc", "qsv", "amf", "videotoolbox", "software"],
): EncoderInfo {
  for (const id of prefer) {
    const hit = encoders.find((e) => e.id === id && e.available);
    if (hit) return hit;
  }
  return {
    id: "software",
    videoCodecFlag: "libx264",
    label: "Software (libx264)",
    available: true,
  };
}

async function probeEncoder(ffmpegBin: string, codec: string): Promise<boolean> {
  // Tiny black frame encode to /dev/null — fails fast without GPU drivers.
  const code = await runExit(ffmpegBin, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=64x64:d=0.04",
    "-frames:v",
    "1",
    "-c:v",
    codec,
    "-f",
    "null",
    "-",
  ]);
  return code === 0;
}

function runText(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (c: Buffer) => {
      out += c.toString("utf8");
    });
    child.stderr.on("data", (c: Buffer) => {
      out += c.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", () => resolve(out));
  });
}

function runExit(bin: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "ignore"] });
    child.on("error", () => resolve(1));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

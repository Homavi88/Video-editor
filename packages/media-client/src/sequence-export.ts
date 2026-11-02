/**
 * Builds an ffmpeg filter_complex graph for sequence export.
 *
 * Modes:
 * - `concat` (default for single track): stitch clips end-to-end
 * - `overlay`: place each clip at its timeline start on a black canvas (multi-track)
 */

import type { Sequence, MediaItem, Clip, Track } from "@lumina/core";
import { clipEnd, ticksToSeconds } from "@lumina/core";
import { runFfmpeg } from "./frame.js";
import { detectEncoders, pickEncoder, type HwEncoderId } from "./encoders.js";

export interface SequenceExportInput {
  readonly sequence: Sequence;
  readonly media: readonly MediaItem[];
  readonly outputPath: string;
  readonly width?: number;
  readonly height?: number;
  readonly fps?: number;
  readonly videoCodec?: string;
  readonly audioCodec?: string;
  readonly crf?: number;
  readonly ffmpegBin?: string;
  /** Prefer HW encoder when videoCodec is h264/libx264. */
  readonly preferHw?: readonly HwEncoderId[];
  readonly mode?: "concat" | "overlay";
}

export interface BuiltExportCommand {
  readonly args: string[];
  readonly description: string;
  readonly encoder: string;
}

export function buildSequenceExportCommand(input: SequenceExportInput): BuiltExportCommand {
  const mode = input.mode ?? inferMode(input.sequence);
  if (mode === "overlay") return buildOverlayCommand(input);
  return buildConcatCommand(input);
}

export async function exportSequence(input: SequenceExportInput): Promise<BuiltExportCommand> {
  let cmd = buildSequenceExportCommand(input);
  if (!input.videoCodec || input.videoCodec === "libx264" || input.videoCodec === "h264") {
    const encoders = await detectEncoders(input.ffmpegBin ?? "ffmpeg");
    const picked = pickEncoder(encoders, input.preferHw);
    if (picked.videoCodecFlag !== "libx264") {
      cmd = {
        ...cmd,
        args: swapVideoCodec(cmd.args, picked.videoCodecFlag),
        encoder: picked.videoCodecFlag,
        description: `${cmd.description} [${picked.label}]`,
      };
    }
  }
  await runFfmpeg(cmd.args, input.ffmpegBin ?? "ffmpeg");
  return cmd;
}

function inferMode(sequence: Sequence): "concat" | "overlay" {
  const activeTracks = sequence.videoTracks.filter(
    (t) => !t.muted && !t.hidden && t.clips.some((c) => c.enabled),
  );
  if (activeTracks.length > 1) return "overlay";
  const clips = activeTracks[0]?.clips.filter((c) => c.enabled) ?? [];
  // Gaps / overlaps → overlay timeline placement
  const sorted = [...clips].sort((a, b) => (a.start < b.start ? -1 : 1));
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i]!.start !== clipEnd(sorted[i - 1]!)) return "overlay";
  }
  return "concat";
}

function buildConcatCommand(input: SequenceExportInput): BuiltExportCommand {
  const { width, height, fps, mediaById } = dims(input);
  const videoTrack =
    [...input.sequence.videoTracks].reverse().find((t) => !t.muted && !t.hidden) ??
    input.sequence.videoTracks[input.sequence.videoTracks.length - 1];
  const audioTrack =
    input.sequence.audioTracks.find((t) => !t.muted) ?? input.sequence.audioTracks[0];

  const vClips = fileClips(videoTrack, mediaById);
  const aClips = fileClips(audioTrack, mediaById);
  if (vClips.length === 0 && aClips.length === 0) {
    throw new Error("sequence has no exportable file-backed clips");
  }

  const args: string[] = ["-y"];
  const filterParts: string[] = [];
  let inputIndex = 0;
  const vLabels: string[] = [];

  for (const { clip, media } of vClips) {
    args.push(
      "-ss",
      String(ticksToSeconds(clip.inPoint)),
      "-t",
      String(ticksToSeconds(clip.duration)),
      "-i",
      media.proxy?.path ?? media.path,
    );
    const label = `v${inputIndex}`;
    filterParts.push(scalePad(inputIndex, width, height, fps, label));
    vLabels.push(`[${label}]`);
    inputIndex += 1;
  }

  const aLabels: string[] = [];
  for (const { clip, media } of aClips) {
    args.push(
      "-ss",
      String(ticksToSeconds(clip.inPoint)),
      "-t",
      String(ticksToSeconds(clip.duration)),
      "-i",
      media.proxy?.path ?? media.path,
    );
    const label = `a${inputIndex}`;
    filterParts.push(
      `[${inputIndex}:a]aformat=sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[${label}]`,
    );
    aLabels.push(`[${label}]`);
    inputIndex += 1;
  }

  if (vLabels.length === 0) {
    const dur = Math.max(1, ...aClips.map(({ clip }) => ticksToSeconds(clipEnd(clip))));
    filterParts.push(`color=c=black:s=${width}x${height}:r=${fps}:d=${dur}[vout]`);
  } else if (vLabels.length === 1) {
    filterParts.push(`${vLabels[0]}null[vout]`);
  } else if (hasAnyCrossfade(vClips)) {
    // Chain xfade for clips that mark transitionOutId (preset id, e.g. crossDissolve).
    let current = vLabels[0]!;
    let currentDur = ticksToSeconds(vClips[0]!.clip.duration);
    for (let i = 1; i < vLabels.length; i += 1) {
      const prev = vClips[i - 1]!.clip;
      const nextLabel = vLabels[i]!;
      const nextDur = ticksToSeconds(vClips[i]!.clip.duration);
      const fade = prev.transitionOutId ? Math.min(1, currentDur / 2, nextDur / 2) : 0;
      const out = i === vLabels.length - 1 ? "vout" : `xf${i}`;
      if (fade > 0.01) {
        const offset = Math.max(0, currentDur - fade);
        const xfadeName = xfadeNameFor(prev.transitionOutId);
        filterParts.push(
          `${current}${nextLabel}xfade=transition=${xfadeName}:duration=${fade.toFixed(3)}:offset=${offset.toFixed(3)}[${out}]`,
        );
        currentDur = currentDur + nextDur - fade;
      } else {
        filterParts.push(`${current}${nextLabel}concat=n=2:v=1:a=0[${out}]`);
        currentDur = currentDur + nextDur;
      }
      current = `[${out}]`;
    }
  } else {
    filterParts.push(`${vLabels.join("")}concat=n=${vLabels.length}:v=1:a=0[vout]`);
  }

  if (aLabels.length === 0) {
    filterParts.push(`anullsrc=r=48000:cl=stereo,atrim=0:1[aout]`);
  } else if (aLabels.length === 1) {
    filterParts.push(`${aLabels[0]}anull[aout]`);
  } else {
    filterParts.push(`${aLabels.join("")}concat=n=${aLabels.length}:v=0:a=1[aout]`);
  }

  pushMaps(args, filterParts, input, width, height);
  return {
    args,
    description: `Concat ${vClips.length}V/${aClips.length}A → ${input.outputPath}`,
    encoder: input.videoCodec ?? "libx264",
  };
}

/**
 * Overlay mode: black canvas for sequence duration; each clip delayed to start
 * and overlaid bottom→top across video tracks.
 */
function buildOverlayCommand(input: SequenceExportInput): BuiltExportCommand {
  const { width, height, fps, mediaById } = dims(input);
  const durationSec = Math.max(
    1,
    sequenceDurationSeconds(input.sequence),
  );

  const layers: Array<{ clip: Clip; media: MediaItem; trackIndex: number }> = [];
  // Bottom track first (last in videoTracks array is V1 visually at bottom in our UI)
  const bottomUp = [...input.sequence.videoTracks].reverse();
  bottomUp.forEach((track, trackIndex) => {
    if (track.muted || track.hidden) return;
    for (const clip of track.clips) {
      if (!clip.enabled) continue;
      const media = resolveMedia(clip, mediaById);
      if (!media || !isFilePath(media.path)) continue;
      layers.push({ clip, media, trackIndex });
    }
  });

  const audioClips = input.sequence.audioTracks
    .filter((t) => !t.muted)
    .flatMap((t) => fileClips(t, mediaById));

  if (layers.length === 0 && audioClips.length === 0) {
    throw new Error("sequence has no exportable file-backed clips");
  }

  const args: string[] = ["-y"];
  const filterParts: string[] = [
    `color=c=black:s=${width}x${height}:r=${fps}:d=${durationSec}[base]`,
  ];
  let inputIndex = 0;
  const overlayLabels: string[] = [];

  for (const { clip, media } of layers) {
    const start = ticksToSeconds(clip.start);
    const inSec = ticksToSeconds(clip.inPoint);
    const dur = ticksToSeconds(clip.duration);
    args.push("-ss", String(inSec), "-t", String(dur), "-i", media.proxy?.path ?? media.path);
    const prepared = `p${inputIndex}`;
    filterParts.push(
      `[${inputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${fps},setpts=PTS-STARTPTS+${start}/TB,format=rgba[${prepared}]`,
    );
    overlayLabels.push(prepared);
    inputIndex += 1;
  }

  let current = "base";
  overlayLabels.forEach((label, i) => {
    const next = i === overlayLabels.length - 1 ? "vout" : `o${i}`;
    filterParts.push(`[${current}][${label}]overlay=0:0:format=auto[${next}]`);
    current = next;
  });
  if (overlayLabels.length === 0) {
    filterParts.push(`[base]null[vout]`);
  }

  const aLabels: string[] = [];
  for (const { clip, media } of audioClips) {
    const start = ticksToSeconds(clip.start);
    const inSec = ticksToSeconds(clip.inPoint);
    const dur = ticksToSeconds(clip.duration);
    args.push("-ss", String(inSec), "-t", String(dur), "-i", media.proxy?.path ?? media.path);
    const label = `a${inputIndex}`;
    filterParts.push(
      `[${inputIndex}:a]aformat=sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS,adelay=${Math.round(start * 1000)}|${Math.round(start * 1000)}[${label}]`,
    );
    aLabels.push(`[${label}]`);
    inputIndex += 1;
  }

  if (aLabels.length === 0) {
    filterParts.push(`anullsrc=r=48000:cl=stereo,atrim=0:${durationSec}[aout]`);
  } else if (aLabels.length === 1) {
    filterParts.push(`${aLabels[0]}anull[aout]`);
  } else {
    filterParts.push(
      `${aLabels.join("")}amix=inputs=${aLabels.length}:normalize=0[aout]`,
    );
  }

  pushMaps(args, filterParts, input, width, height);
  return {
    args,
    description: `Overlay ${layers.length}V/${audioClips.length}A → ${input.outputPath}`,
    encoder: input.videoCodec ?? "libx264",
  };
}

function dims(input: SequenceExportInput) {
  return {
    width: input.width ?? input.sequence.width,
    height: input.height ?? input.sequence.height,
    fps:
      input.fps ??
      input.sequence.frameRate.numerator / input.sequence.frameRate.denominator,
    mediaById: new Map(input.media.map((m) => [m.id, m])),
  };
}

function fileClips(
  track: Track | undefined,
  mediaById: Map<string, MediaItem>,
): Array<{ clip: Clip; media: MediaItem }> {
  return (track?.clips ?? [])
    .filter((c) => c.enabled)
    .slice()
    .sort((a, b) => (a.start < b.start ? -1 : 1))
    .map((c) => ({ clip: c, media: resolveMedia(c, mediaById) }))
    .filter((x): x is { clip: Clip; media: MediaItem } => Boolean(x.media && isFilePath(x.media.path)));
}

function scalePad(
  inputIndex: number,
  width: number,
  height: number,
  fps: number,
  label: string,
): string {
  return `[${inputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${fps},setpts=PTS-STARTPTS,setsar=1[${label}]`;
}

function pushMaps(
  args: string[],
  filterParts: string[],
  input: SequenceExportInput,
  _width: number,
  _height: number,
): void {
  args.push(
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-c:v",
    input.videoCodec ?? "libx264",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    String(input.crf ?? 20),
    "-c:a",
    input.audioCodec ?? "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    "-shortest",
    input.outputPath,
  );
}

function swapVideoCodec(args: string[], codec: string): string[] {
  const next = [...args];
  const idx = next.indexOf("-c:v");
  if (idx >= 0 && idx + 1 < next.length) next[idx + 1] = codec;
  // NVENC prefers -cq over -crf
  if (codec.includes("nvenc") || codec.includes("qsv") || codec.includes("amf")) {
    const crfIdx = next.indexOf("-crf");
    if (crfIdx >= 0) {
      next[crfIdx] = codec.includes("nvenc") ? "-cq" : "-q:v";
    }
  }
  return next;
}

function sequenceDurationSeconds(sequence: Sequence): number {
  let max = 0n;
  for (const t of [...sequence.videoTracks, ...sequence.audioTracks]) {
    for (const c of t.clips) {
      const e = clipEnd(c);
      if (e > max) max = e;
    }
  }
  return Math.max(1, ticksToSeconds(max));
}

function resolveMedia(clip: Clip, mediaById: Map<string, MediaItem>): MediaItem | undefined {
  if (clip.source.type !== "media") return undefined;
  return mediaById.get(clip.source.mediaId);
}

function isFilePath(p: string): boolean {
  return !p.startsWith("demo://") && (p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p));
}

function hasAnyCrossfade(clips: Array<{ clip: Clip }>): boolean {
  return clips.some(({ clip }) => Boolean(clip.transitionOutId));
}

function xfadeNameFor(presetId: string | undefined): string {
  switch (presetId) {
    case "wipeLeft":
      return "wipeleft";
    case "wipeRight":
      return "wiperight";
    case "wipeUp":
      return "wipeup";
    case "wipeDown":
      return "wipedown";
    case "slideLeft":
      return "slideleft";
    case "dipToBlack":
      return "fadeblack";
    case "dipToWhite":
      return "fadewhite";
    default:
      return "fade";
  }
}

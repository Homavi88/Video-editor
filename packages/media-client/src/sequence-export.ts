/**
 * Builds an ffmpeg filter_complex graph that concatenates/overlays a simplified
 * sequence (single video track + single audio track) for the Converter/Export path.
 *
 * Full multi-track GPU compose remains in the render graph; this path is the
 * reliable CPU fallback used by the export queue.
 */

import type { Sequence, MediaItem, Clip } from "@lumina/core";
import { clipEnd, ticksToSeconds } from "@lumina/core";
import { runFfmpeg } from "./frame.js";

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
}

export interface BuiltExportCommand {
  readonly args: string[];
  readonly description: string;
}

/**
 * Flattens the bottom-most video track and first audio track into an ffmpeg
 * concat/overlay command. Clips without resolvable file paths are skipped.
 */
export function buildSequenceExportCommand(input: SequenceExportInput): BuiltExportCommand {
  const width = input.width ?? input.sequence.width;
  const height = input.height ?? input.sequence.height;
  const fps =
    input.fps ??
    input.sequence.frameRate.numerator / input.sequence.frameRate.denominator;
  const mediaById = new Map(input.media.map((m) => [m.id, m]));

  const videoTrack =
    [...input.sequence.videoTracks].reverse().find((t) => !t.muted && !t.hidden) ??
    input.sequence.videoTracks[input.sequence.videoTracks.length - 1];
  const audioTrack = input.sequence.audioTracks.find((t) => !t.muted) ?? input.sequence.audioTracks[0];

  const vClips = (videoTrack?.clips ?? [])
    .filter((c) => c.enabled)
    .slice()
    .sort((a, b) => (a.start < b.start ? -1 : 1))
    .map((c) => ({ clip: c, media: resolveMedia(c, mediaById) }))
    .filter((x): x is { clip: Clip; media: MediaItem } => Boolean(x.media && isFilePath(x.media.path)));

  const aClips = (audioTrack?.clips ?? [])
    .filter((c) => c.enabled)
    .slice()
    .sort((a, b) => (a.start < b.start ? -1 : 1))
    .map((c) => ({ clip: c, media: resolveMedia(c, mediaById) }))
    .filter((x): x is { clip: Clip; media: MediaItem } => Boolean(x.media && isFilePath(x.media.path)));

  if (vClips.length === 0 && aClips.length === 0) {
    throw new Error("sequence has no exportable file-backed clips");
  }

  const args: string[] = ["-y"];
  const filterParts: string[] = [];
  let inputIndex = 0;

  const vLabels: string[] = [];
  for (const { clip, media } of vClips) {
    const inSec = ticksToSeconds(clip.inPoint);
    const dur = ticksToSeconds(clip.duration);
    args.push("-ss", String(inSec), "-t", String(dur), "-i", media.proxy?.path ?? media.path);
    const label = `v${inputIndex}`;
    filterParts.push(
      `[${inputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${fps},setpts=PTS-STARTPTS,setsar=1[${label}]`,
    );
    vLabels.push(`[${label}]`);
    inputIndex += 1;
  }

  const aLabels: string[] = [];
  for (const { clip, media } of aClips) {
    const inSec = ticksToSeconds(clip.inPoint);
    const dur = ticksToSeconds(clip.duration);
    args.push("-ss", String(inSec), "-t", String(dur), "-i", media.proxy?.path ?? media.path);
    const label = `a${inputIndex}`;
    filterParts.push(
      `[${inputIndex}:a]aformat=sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[${label}]`,
    );
    aLabels.push(`[${label}]`);
    inputIndex += 1;
  }

  // If we only have audio clips but need video, generate black.
  if (vLabels.length === 0) {
    const dur = Math.max(
      1,
      ...aClips.map(({ clip }) => ticksToSeconds(clipEnd(clip))),
    );
    filterParts.push(
      `color=c=black:s=${width}x${height}:r=${fps}:d=${dur}[vout]`,
    );
  } else if (vLabels.length === 1) {
    filterParts.push(`${vLabels[0]}null[vout]`);
  } else {
    filterParts.push(
      `${vLabels.join("")}concat=n=${vLabels.length}:v=1:a=0[vout]`,
    );
  }

  if (aLabels.length === 0) {
    filterParts.push(`anullsrc=r=48000:cl=stereo,atrim=0:1[aout]`);
  } else if (aLabels.length === 1) {
    filterParts.push(`${aLabels[0]}anull[aout]`);
  } else {
    filterParts.push(
      `${aLabels.join("")}concat=n=${aLabels.length}:v=0:a=1[aout]`,
    );
  }

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
    input.outputPath,
  );

  return {
    args,
    description: `Export ${vClips.length}V/${aClips.length}A clips → ${input.outputPath}`,
  };
}

/** Runs {@link buildSequenceExportCommand}. */
export async function exportSequence(input: SequenceExportInput): Promise<BuiltExportCommand> {
  const cmd = buildSequenceExportCommand(input);
  await runFfmpeg(cmd.args, input.ffmpegBin ?? "ffmpeg");
  return cmd;
}

function resolveMedia(clip: Clip, mediaById: Map<string, MediaItem>): MediaItem | undefined {
  if (clip.source.type !== "media") return undefined;
  return mediaById.get(clip.source.mediaId);
}

function isFilePath(p: string): boolean {
  return !p.startsWith("demo://") && (p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p));
}

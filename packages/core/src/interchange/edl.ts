/**
 * CMX3600-ish EDL export (subset) for sequence interchange.
 */

import type { Sequence } from "../model/sequence.js";
import type { MediaItem } from "../model/media.js";
import { ticksToSeconds } from "../util/time.js";
import { clipEnd } from "../model/clip.js";

function tc(seconds: number, fps: number): string {
  const total = Math.max(0, Math.floor(seconds * fps));
  const roundedFps = Math.round(fps);
  const f = total % roundedFps;
  const sTotal = Math.floor(total / roundedFps);
  const s = sTotal % 60;
  const mTotal = Math.floor(sTotal / 60);
  const m = mTotal % 60;
  const h = Math.floor(mTotal / 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`;
}

/** Exports a simple EDL from the bottom video track. */
export function exportEdl(sequence: Sequence, media: readonly MediaItem[]): string {
  const fps = sequence.frameRate.numerator / sequence.frameRate.denominator;
  const mediaById = new Map(media.map((m) => [m.id, m]));
  const track = sequence.videoTracks[sequence.videoTracks.length - 1];
  const lines = [`TITLE: ${sequence.name}`, `FCM: NON-DROP FRAME`, ``];
  let event = 1;
  for (const clip of [...(track?.clips ?? [])].sort((a, b) => (a.start < b.start ? -1 : 1))) {
    if (clip.source.type !== "media") continue;
    const item = mediaById.get(clip.source.mediaId);
    const reel = (item?.name ?? "AX").replace(/\W+/g, "").slice(0, 8).toUpperCase() || "AX";
    const srcIn = tc(ticksToSeconds(clip.inPoint), fps);
    const srcOut = tc(ticksToSeconds(clip.outPoint), fps);
    const recIn = tc(ticksToSeconds(clip.start), fps);
    const recOut = tc(ticksToSeconds(clipEnd(clip)), fps);
    lines.push(
      `${String(event).padStart(3, "0")}  ${reel.padEnd(8, " ")} V     C        ${srcIn} ${srcOut} ${recIn} ${recOut}`,
    );
    lines.push(`* FROM CLIP NAME: ${clip.name}`);
    event += 1;
  }
  return `${lines.join("\n")}\n`;
}

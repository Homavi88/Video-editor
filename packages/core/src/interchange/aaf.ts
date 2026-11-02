/**
 * AAF-lite interchange: a simplified XML document capturing sequence structure.
 * Not a full AAF binary — enough for round-trip planning and third-party import sketches.
 */

import type { Sequence } from "../model/sequence.js";
import type { MediaItem } from "../model/media.js";
import { clipEnd } from "../model/clip.js";
import { ticksToSeconds } from "../util/time.js";

/** Serializes a sequence to a compact AAF-inspired XML string. */
export function exportAafLite(
  sequence: Sequence,
  media: readonly MediaItem[],
  projectName = "Lumina Project",
): string {
  const mediaById = new Map(media.map((m) => [m.id, m]));
  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<AafLite version="0.1" project="${esc(projectName)}">`,
    `  <Sequence name="${esc(sequence.name)}" width="${sequence.width}" height="${sequence.height}" fps="${sequence.frameRate.numerator}/${sequence.frameRate.denominator}">`,
  ];

  for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
    lines.push(
      `    <Track id="${esc(track.id)}" name="${esc(track.name)}" kind="${track.kind}" muted="${track.muted}" solo="${track.solo}">`,
    );
    for (const clip of track.clips) {
      const src =
        clip.source.type === "media"
          ? mediaById.get(clip.source.mediaId)
          : undefined;
      lines.push(
        `      <Clip id="${esc(clip.id)}" name="${esc(clip.name)}" start="${ticksToSeconds(clip.start)}" duration="${ticksToSeconds(clip.duration)}" in="${ticksToSeconds(clip.inPoint)}" out="${ticksToSeconds(clip.outPoint)}" end="${ticksToSeconds(clipEnd(clip))}" speed="${clip.speed}" blend="${clip.blendMode}" path="${esc(src?.path ?? "")}" />`,
      );
    }
    lines.push(`    </Track>`);
  }

  lines.push(`  </Sequence>`);
  lines.push(`</AafLite>`);
  return lines.join("\n");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

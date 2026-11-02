/**
 * Minimal FCPXML 1.9 export for a single sequence (interchange starter).
 */

import type { Sequence } from "../model/sequence.js";
import type { MediaItem } from "../model/media.js";
import { ticksToSeconds } from "../util/time.js";
import { clipEnd } from "../model/clip.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/** Exports a minimal FCPXML document. */
export function exportFcpxml(
  sequence: Sequence,
  media: readonly MediaItem[],
  projectName: string,
): string {
  const assets = media
    .map((m, i) => {
      const dur = ticksToSeconds(m.metadata.duration);
      return `    <asset id="r${i + 1}" name="${esc(m.name)}" start="0s" duration="${dur}s" hasVideo="${m.metadata.hasVideo ? 1 : 0}" hasAudio="${m.metadata.hasAudio ? 1 : 0}">
      <media-rep kind="original-media" src="${esc(pathToFileUrl(m.path))}"/>
    </asset>`;
    })
    .join("\n");

  const idByMedia = new Map(media.map((m, i) => [m.id, `r${i + 1}`]));
  const spineClips: string[] = [];
  const track = sequence.videoTracks[sequence.videoTracks.length - 1];
  for (const clip of track?.clips ?? []) {
    if (clip.source.type !== "media") continue;
    const ref = idByMedia.get(clip.source.mediaId);
    if (!ref) continue;
    spineClips.push(
      `          <asset-clip name="${esc(clip.name)}" ref="${ref}" offset="${ticksToSeconds(clip.start)}s" start="${ticksToSeconds(clip.inPoint)}s" duration="${ticksToSeconds(clip.duration)}s" tcFormat="NDF"/>`,
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
${assets}
  </resources>
  <library>
    <event name="${esc(projectName)}">
      <project name="${esc(sequence.name)}">
        <sequence duration="${Math.max(1, ticksToSeconds(clipEndMax(sequence)))}s" tcStart="0s" tcFormat="NDF">
          <spine>
${spineClips.join("\n")}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
}

function clipEndMax(sequence: Sequence): bigint {
  let max = 0n;
  for (const t of [...sequence.videoTracks, ...sequence.audioTracks]) {
    for (const c of t.clips) {
      const e = clipEnd(c);
      if (e > max) max = e;
    }
  }
  return max;
}

function pathToFileUrl(p: string): string {
  if (p.startsWith("file:")) return p;
  if (p.startsWith("demo://")) return p;
  return `file://${encodeURI(p)}`;
}

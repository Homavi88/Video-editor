/**
 * OpenTimelineIO-compatible JSON (OTIO schema subset) export helpers.
 */

import type { Sequence } from "../model/sequence.js";
import type { MediaItem } from "../model/media.js";
import { ticksToSeconds } from "../util/time.js";

export interface OtioTimeline {
  readonly OTIO_SCHEMA: "Timeline.1";
  readonly name: string;
  readonly tracks: {
    readonly OTIO_SCHEMA: "Stack.1";
    readonly children: OtioTrack[];
  };
}

interface OtioTrack {
  readonly OTIO_SCHEMA: "Track.1";
  readonly name: string;
  readonly kind: "Video" | "Audio";
  readonly children: Array<OtioClip | OtioGap>;
}

interface OtioGap {
  readonly OTIO_SCHEMA: "Gap.1";
  readonly name: string;
  readonly source_range: {
    readonly start_time: { readonly value: number; readonly rate: number };
    readonly duration: { readonly value: number; readonly rate: number };
  };
}

interface OtioClip {
  readonly OTIO_SCHEMA: "Clip.1";
  readonly name: string;
  readonly source_range: {
    readonly start_time: { readonly value: number; readonly rate: number };
    readonly duration: { readonly value: number; readonly rate: number };
  };
  readonly media_reference: {
    readonly OTIO_SCHEMA: "ExternalReference.1";
    readonly target_url: string;
    readonly available_range: {
      readonly start_time: { readonly value: number; readonly rate: number };
      readonly duration: { readonly value: number; readonly rate: number };
    };
  };
}

/** Exports OTIO JSON object for the sequence. */
export function exportOtio(sequence: Sequence, media: readonly MediaItem[]): OtioTimeline {
  const rate = sequence.frameRate.numerator / sequence.frameRate.denominator;
  const mediaById = new Map(media.map((m) => [m.id, m]));
  const tracks: OtioTrack[] = [];

  for (const track of sequence.videoTracks) {
    tracks.push(toOtioTrack(track.name, "Video", track.clips, mediaById, rate));
  }
  for (const track of sequence.audioTracks) {
    tracks.push(toOtioTrack(track.name, "Audio", track.clips, mediaById, rate));
  }

  return {
    OTIO_SCHEMA: "Timeline.1",
    name: sequence.name,
    tracks: { OTIO_SCHEMA: "Stack.1", children: tracks },
  };
}

export function exportOtioJson(sequence: Sequence, media: readonly MediaItem[]): string {
  return `${JSON.stringify(exportOtio(sequence, media), null, 2)}\n`;
}

function toOtioTrack(
  name: string,
  kind: "Video" | "Audio",
  clips: Sequence["videoTracks"][number]["clips"],
  mediaById: Map<string, MediaItem>,
  rate: number,
): OtioTrack {
  const children: Array<OtioClip | OtioGap> = [];
  const sorted = [...clips].sort((a, b) => (a.start < b.start ? -1 : 1));
  let cursor = 0;
  for (const clip of sorted) {
    if (clip.source.type !== "media") continue;
    const item = mediaById.get(clip.source.mediaId);
    if (!item) continue;
    const startSec = ticksToSeconds(clip.start);
    if (startSec > cursor + 1e-6) {
      children.push({
        OTIO_SCHEMA: "Gap.1",
        name: "Gap",
        source_range: {
          start_time: { value: 0, rate },
          duration: { value: (startSec - cursor) * rate, rate },
        },
      });
    }
    children.push({
      OTIO_SCHEMA: "Clip.1",
      name: clip.name,
      source_range: {
        start_time: { value: ticksToSeconds(clip.inPoint) * rate, rate },
        duration: { value: ticksToSeconds(clip.duration) * rate, rate },
      },
      media_reference: {
        OTIO_SCHEMA: "ExternalReference.1",
        target_url: item.path,
        available_range: {
          start_time: { value: 0, rate },
          duration: { value: ticksToSeconds(item.metadata.duration) * rate, rate },
        },
      },
    });
    cursor = startSec + ticksToSeconds(clip.duration);
  }
  return { OTIO_SCHEMA: "Track.1", name, kind, children };
}

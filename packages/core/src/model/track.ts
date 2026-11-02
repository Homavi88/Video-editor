import type { TrackId } from "../util/id.js";
import { createId } from "../util/id.js";
import type { TrackKind } from "./enums.js";
import type { Clip } from "./clip.js";
import { clipEnd, clipsOverlap } from "./clip.js";

/** A single timeline track holding ordered clips of one kind family. */
export interface Track {
  readonly id: TrackId;
  readonly kind: TrackKind;
  readonly name: string;
  readonly locked: boolean;
  readonly muted: boolean;
  readonly solo: boolean;
  readonly hidden: boolean;
  /** UI height hint in pixels. */
  readonly height: number;
  readonly clips: readonly Clip[];
}

export interface CreateTrackInput {
  readonly kind: TrackKind;
  readonly name?: string;
  readonly height?: number;
}

/** Creates an empty track with sensible defaults. */
export function createTrack(input: CreateTrackInput): Track {
  const defaults: Record<TrackKind, { name: string; height: number }> = {
    video: { name: "V1", height: 64 },
    audio: { name: "A1", height: 48 },
    subtitle: { name: "S1", height: 36 },
    adjustment: { name: "ADJ1", height: 40 },
  };
  const d = defaults[input.kind];
  return {
    id: createId<"Track">(),
    kind: input.kind,
    name: input.name ?? d.name,
    locked: false,
    muted: false,
    solo: false,
    hidden: false,
    height: input.height ?? d.height,
    clips: [],
  };
}

/** Returns clips on the track sorted by timeline start. */
export function sortedClips(track: Track): Clip[] {
  return [...track.clips].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

/**
 * Inserts a clip onto a track. When `mode` is `"overwrite"`, overlapping regions
 * of existing clips are trimmed/removed. When `"insert"`, later clips are rippled
 * forward by `clip.duration`.
 */
export function placeClip(
  track: Track,
  clip: Clip,
  mode: "overwrite" | "insert",
): Track {
  if (track.locked) {
    throw new Error(`track "${track.name}" is locked`);
  }
  if (mode === "insert") {
    const shifted = track.clips.map((c) =>
      c.start >= clip.start ? { ...c, start: c.start + clip.duration } : c,
    );
    return { ...track, clips: [...shifted, clip] };
  }

  const result: Clip[] = [];
  for (const existing of track.clips) {
    if (!clipsOverlap(existing, clip)) {
      result.push(existing);
      continue;
    }
    // Keep left remnant.
    if (existing.start < clip.start) {
      const leftDur = clip.start - existing.start;
      result.push({
        ...existing,
        duration: leftDur,
        outPoint: existing.inPoint + scaleSource(existing, leftDur),
      });
    }
    // Keep right remnant.
    const existingEnd = clipEnd(existing);
    const clipEndTime = clipEnd(clip);
    if (existingEnd > clipEndTime) {
      const trimTicks = clipEndTime - existing.start;
      const newIn = existing.inPoint + scaleSource(existing, trimTicks);
      result.push({
        ...existing,
        id: createId<"Clip">(),
        start: clipEndTime,
        duration: existingEnd - clipEndTime,
        inPoint: newIn,
      });
    }
  }
  result.push(clip);
  return { ...track, clips: result };
}

function scaleSource(clip: Clip, timelineDuration: bigint): bigint {
  return BigInt(Math.round(Number(timelineDuration) * Math.abs(clip.speed)));
}

/** Splits a clip at `time` (sequence ticks). Returns the track with two halves. */
export function splitClipAt(track: Track, clipId: string, time: bigint): Track {
  const clip = track.clips.find((c) => c.id === clipId);
  if (!clip) throw new Error(`clip ${clipId} not found`);
  if (time <= clip.start || time >= clipEnd(clip)) {
    throw new RangeError("split time must be strictly inside the clip");
  }
  const leftDur = time - clip.start;
  const rightDur = clip.duration - leftDur;
  const left: Clip = {
    ...clip,
    duration: leftDur,
    outPoint: clip.inPoint + scaleSource(clip, leftDur),
  };
  const right: Clip = {
    ...clip,
    id: createId<"Clip">(),
    start: time,
    duration: rightDur,
    inPoint: left.outPoint,
  };
  return {
    ...track,
    clips: track.clips.flatMap((c) => (c.id === clipId ? [left, right] : [c])),
  };
}

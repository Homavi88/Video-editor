import type { MarkerId, SequenceId } from "../util/id.js";
import { createId } from "../util/id.js";
import type { TimeTicks, RationalRate } from "../util/time.js";
import { FRAME_RATES, framesToTicks } from "../util/time.js";
import type { ColorLabel, ColorSpace } from "./enums.js";
import type { Track } from "./track.js";
import { createTrack } from "./track.js";
import { clipEnd } from "./clip.js";

/** Timeline marker. */
export interface Marker {
  readonly id: MarkerId;
  readonly time: TimeTicks;
  readonly duration: TimeTicks;
  readonly name: string;
  readonly comment: string;
  readonly label: ColorLabel;
}

/** A sequence (timeline) inside a project. */
export interface Sequence {
  readonly id: SequenceId;
  readonly name: string;
  readonly frameRate: RationalRate;
  readonly width: number;
  readonly height: number;
  readonly sampleRate: number;
  readonly audioChannels: 1 | 2 | 6;
  readonly colorSpace: ColorSpace;
  readonly videoTracks: readonly Track[];
  readonly audioTracks: readonly Track[];
  readonly subtitleTracks: readonly Track[];
  readonly markers: readonly Marker[];
  /** Optional In/Out range for 3-point editing / export. */
  readonly inPoint: TimeTicks | null;
  readonly outPoint: TimeTicks | null;
}

export interface CreateSequenceInput {
  readonly name?: string;
  readonly frameRate?: RationalRate;
  readonly width?: number;
  readonly height?: number;
  readonly sampleRate?: number;
  readonly audioChannels?: 1 | 2 | 6;
  readonly colorSpace?: ColorSpace;
  readonly videoTrackCount?: number;
  readonly audioTrackCount?: number;
}

/** Creates a sequence with the requested empty video/audio tracks. */
export function createSequence(input: CreateSequenceInput = {}): Sequence {
  const videoCount = input.videoTrackCount ?? 3;
  const audioCount = input.audioTrackCount ?? 3;
  const videoTracks = Array.from({ length: videoCount }, (_, i) =>
    createTrack({ kind: "video", name: `V${videoCount - i}` }),
  );
  // Video tracks are stored top-to-bottom as Vn..V1 (highest layer first).
  const audioTracks = Array.from({ length: audioCount }, (_, i) =>
    createTrack({ kind: "audio", name: `A${i + 1}` }),
  );
  return {
    id: createId<"Sequence">(),
    name: input.name ?? "Sequence 01",
    frameRate: input.frameRate ?? FRAME_RATES.fps25,
    width: input.width ?? 1920,
    height: input.height ?? 1080,
    sampleRate: input.sampleRate ?? 48000,
    audioChannels: input.audioChannels ?? 2,
    colorSpace: input.colorSpace ?? "rec709",
    videoTracks,
    audioTracks,
    subtitleTracks: [],
    markers: [],
    inPoint: null,
    outPoint: null,
  };
}

/** Computes the sequence duration as the latest clip end across all tracks. */
export function sequenceDuration(sequence: Sequence): TimeTicks {
  let max: TimeTicks = 0n;
  const all = [...sequence.videoTracks, ...sequence.audioTracks, ...sequence.subtitleTracks];
  for (const track of all) {
    for (const clip of track.clips) {
      const end = clipEnd(clip);
      if (end > max) max = end;
    }
  }
  // Always at least one frame so empty sequences still play a black frame.
  const minDur = framesToTicks(1, sequence.frameRate);
  return max > minDur ? max : minDur;
}

/** Adds a marker to the sequence. */
export function addMarker(
  sequence: Sequence,
  time: TimeTicks,
  name = "Marker",
  label: ColorLabel = "red",
): Sequence {
  const marker: Marker = {
    id: createId<"Marker">(),
    time,
    duration: 0n,
    name,
    comment: "",
    label,
  };
  return { ...sequence, markers: [...sequence.markers, marker] };
}

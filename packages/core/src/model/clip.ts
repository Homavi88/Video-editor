import type { ClipId, MediaItemId, SequenceId, TransitionId } from "../util/id.js";
import { createId } from "../util/id.js";
import type { TimeTicks } from "../util/time.js";
import type { BlendMode, ClipKind, ColorLabel } from "./enums.js";
import type { EffectInstance } from "./effect.js";
import { createDefaultTransform } from "./effect.js";

/**
 * A clip placed on a track. Source timing is expressed in media ticks;
 * timeline placement uses `start` / `duration` on the sequence timeline.
 */
export interface Clip {
  readonly id: ClipId;
  readonly kind: ClipKind;
  /** Media pool item, nested sequence, or generated content source. */
  readonly source:
    | { readonly type: "media"; readonly mediaId: MediaItemId }
    | { readonly type: "sequence"; readonly sequenceId: SequenceId }
    | { readonly type: "generated"; readonly generatorId: string };
  /** Timeline start time of the clip (sequence ticks). */
  readonly start: TimeTicks;
  /** Visible duration on the timeline. */
  readonly duration: TimeTicks;
  /** In-point into the source media. */
  readonly inPoint: TimeTicks;
  /** Out-point into the source media (exclusive). */
  readonly outPoint: TimeTicks;
  /** Playback rate multiplier (1 = realtime, negative = reverse). */
  readonly speed: number;
  readonly enabled: boolean;
  readonly locked: boolean;
  readonly name: string;
  readonly label: ColorLabel;
  readonly blendMode: BlendMode;
  readonly effects: readonly EffectInstance[];
  /** Transition attached to the incoming edge (shared with previous clip when overlapping). */
  readonly transitionInId?: TransitionId;
  readonly transitionOutId?: TransitionId;
  /** Linked partner clip ids (A/V link groups). */
  readonly linkedClipIds: readonly ClipId[];
}

export interface CreateClipInput {
  readonly kind: ClipKind;
  readonly source: Clip["source"];
  readonly start: TimeTicks;
  readonly duration: TimeTicks;
  readonly inPoint?: TimeTicks;
  readonly outPoint?: TimeTicks;
  readonly name?: string;
  readonly label?: ColorLabel;
  readonly blendMode?: BlendMode;
  readonly speed?: number;
  readonly effects?: readonly EffectInstance[];
  readonly linkedClipIds?: readonly ClipId[];
}

/** Factory for a new clip with a default transform effect. */
export function createClip(input: CreateClipInput): Clip {
  if (input.duration <= 0n) {
    throw new RangeError("clip duration must be positive");
  }
  const inPoint = input.inPoint ?? 0n;
  const outPoint = input.outPoint ?? inPoint + input.duration;
  if (outPoint <= inPoint) {
    throw new RangeError("outPoint must be greater than inPoint");
  }
  const effects = input.effects ?? [createDefaultTransform()];
  return {
    id: createId<"Clip">(),
    kind: input.kind,
    source: input.source,
    start: input.start,
    duration: input.duration,
    inPoint,
    outPoint,
    speed: input.speed ?? 1,
    enabled: true,
    locked: false,
    name: input.name ?? "Clip",
    label: input.label ?? "none",
    blendMode: input.blendMode ?? "normal",
    effects,
    linkedClipIds: input.linkedClipIds ?? [],
  };
}

/** Inclusive timeline range occupied by the clip: `[start, start + duration)`. */
export function clipEnd(clip: Clip): TimeTicks {
  return clip.start + clip.duration;
}

/** Returns true when two clips overlap on the timeline. */
export function clipsOverlap(a: Clip, b: Clip): boolean {
  return a.start < clipEnd(b) && b.start < clipEnd(a);
}

/**
 * Maps a sequence timeline time into source media time, accounting for speed.
 * Returns `null` when `timelineTime` is outside the clip.
 */
export function timelineToSourceTime(clip: Clip, timelineTime: TimeTicks): TimeTicks | null {
  if (timelineTime < clip.start || timelineTime >= clipEnd(clip)) return null;
  const offset = timelineTime - clip.start;
  const scaled = BigInt(Math.round(Number(offset) * Math.abs(clip.speed)));
  if (clip.speed >= 0) {
    return clip.inPoint + scaled;
  }
  return clip.outPoint - scaled;
}

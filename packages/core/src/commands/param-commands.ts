/**
 * Mutate effect parameter constants and keyframes (undoable).
 */

import type { Project } from "../model/project.js";
import { requireActiveSequence, updateSequence } from "../model/project.js";
import type { Sequence } from "../model/sequence.js";
import type { Track } from "../model/track.js";
import type { Clip } from "../model/clip.js";
import type { EffectInstance, EffectParamState } from "../model/effect.js";
import type { Keyframe } from "../model/keyframe.js";
import { createId } from "../util/id.js";
import type { TimeTicks } from "../util/time.js";
import type { Command } from "./command.js";

function mapTrack(sequence: Sequence, trackId: string, fn: (t: Track) => Track): Sequence {
  const map = (tracks: readonly Track[]): Track[] =>
    tracks.map((t) => (t.id === trackId ? fn(t) : t));
  return {
    ...sequence,
    videoTracks: map(sequence.videoTracks),
    audioTracks: map(sequence.audioTracks),
    subtitleTracks: map(sequence.subtitleTracks),
  };
}

function findTrack(sequence: Sequence, trackId: string): Track {
  const track = [...sequence.videoTracks, ...sequence.audioTracks, ...sequence.subtitleTracks].find(
    (t) => t.id === trackId,
  );
  if (!track) throw new Error(`track ${trackId} not found`);
  return track;
}

function patchEffect(
  clip: Clip,
  effectId: string,
  fn: (fx: EffectInstance) => EffectInstance,
): Clip {
  return {
    ...clip,
    effects: clip.effects.map((fx) => (fx.id === effectId ? fn(fx) : fx)),
  };
}

/** Sets a constant numeric (or any) effect parameter value. */
export class SetEffectParamCommand implements Command {
  readonly type = "effect.setParam";
  readonly label = "Set Effect Param";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
    private readonly effectId: string,
    private readonly paramKey: string,
    private readonly value: number,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const track = findTrack(sequence, this.trackId);
    const clip = track.clips.find((c) => c.id === this.clipId);
    if (!clip) throw new Error("clip not found");
    const next = patchEffect(clip, this.effectId, (fx) => {
      const prev = fx.params[this.paramKey];
      let state: EffectParamState;
      if (prev?.mode === "keyframes") {
        // Keep curve mode but snap constant override by converting to constant.
        state = { mode: "constant", value: this.value };
      } else {
        state = { mode: "constant", value: this.value };
      }
      return { ...fx, params: { ...fx.params, [this.paramKey]: state } };
    });
    return updateSequence(
      project,
      mapTrack(sequence, this.trackId, () => ({
        ...track,
        clips: track.clips.map((c) => (c.id === clip.id ? next : c)),
      })),
    );
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("SetEffectParamCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Adds or updates a keyframe on an effect parameter at `time`. */
export class AddEffectKeyframeCommand implements Command {
  readonly type = "effect.addKeyframe";
  readonly label = "Add Keyframe";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
    private readonly effectId: string,
    private readonly paramKey: string,
    private readonly time: TimeTicks,
    private readonly value: number,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const track = findTrack(sequence, this.trackId);
    const clip = track.clips.find((c) => c.id === this.clipId);
    if (!clip) throw new Error("clip not found");
    const next = patchEffect(clip, this.effectId, (fx) => {
      const prev = fx.params[this.paramKey];
      const existing: Keyframe<number>[] =
        prev?.mode === "keyframes"
          ? [...prev.keyframes]
          : [
              {
                id: createId<"Keyframe">(),
                time: 0n,
                value: prev?.mode === "constant" && typeof prev.value === "number" ? prev.value : this.value,
                interpolation: "linear",
              },
            ];
      const idx = existing.findIndex((k) => k.time === this.time);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx]!, value: this.value };
      } else {
        existing.push({
          id: createId<"Keyframe">(),
          time: this.time,
          value: this.value,
          interpolation: "linear",
        });
      }
      existing.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
      return {
        ...fx,
        params: { ...fx.params, [this.paramKey]: { mode: "keyframes", keyframes: existing } },
      };
    });
    return updateSequence(
      project,
      mapTrack(sequence, this.trackId, () => ({
        ...track,
        clips: track.clips.map((c) => (c.id === clip.id ? next : c)),
      })),
    );
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("AddEffectKeyframeCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Enables / disables an effect instance. */
export class SetEffectEnabledCommand implements Command {
  readonly type = "effect.setEnabled";
  readonly label = "Toggle Effect";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
    private readonly effectId: string,
    private readonly enabled: boolean,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const track = findTrack(sequence, this.trackId);
    const clip = track.clips.find((c) => c.id === this.clipId);
    if (!clip) throw new Error("clip not found");
    const next = patchEffect(clip, this.effectId, (fx) => ({ ...fx, enabled: this.enabled }));
    return updateSequence(
      project,
      mapTrack(sequence, this.trackId, () => ({
        ...track,
        clips: track.clips.map((c) => (c.id === clip.id ? next : c)),
      })),
    );
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("SetEffectEnabledCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

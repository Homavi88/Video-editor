/**
 * Commands that mutate clip effect stacks / blend mode.
 */

import type { Project } from "../model/project.js";
import { requireActiveSequence, updateSequence } from "../model/project.js";
import type { Sequence } from "../model/sequence.js";
import type { Track } from "../model/track.js";
import type { Clip } from "../model/clip.js";
import type { EffectInstance } from "../model/effect.js";
import { createId } from "../util/id.js";
import type { Command } from "./command.js";
import type { BlendMode } from "../model/enums.js";
import { getEffectPreset } from "../effects/catalog.js";

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

/** Appends a built-in (or known) effect preset onto a clip. */
export class AddEffectCommand implements Command {
  readonly type = "clip.addEffect";
  readonly label = "Add Effect";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
    private readonly typeId: string,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const track = findTrack(sequence, this.trackId);
    const clip = track.clips.find((c) => c.id === this.clipId);
    if (!clip) throw new Error("clip not found");
    const preset = getEffectPreset(this.typeId);
    if (!preset) throw new Error(`unknown effect ${this.typeId}`);
    const params: Record<string, EffectInstance["params"][string]> = {};
    for (const p of preset.params) {
      params[p.key] = { mode: "constant", value: p.defaultValue };
    }
    const effect: EffectInstance = {
      id: createId<"Effect">(),
      typeId: preset.typeId,
      enabled: true,
      params,
    };
    const next: Clip = { ...clip, effects: [...clip.effects, effect] };
    return updateSequence(
      project,
      mapTrack(sequence, this.trackId, () => ({
        ...track,
        clips: track.clips.map((c) => (c.id === clip.id ? next : c)),
      })),
    );
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("AddEffectCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Sets clip blend mode. */
export class SetBlendModeCommand implements Command {
  readonly type = "clip.setBlendMode";
  readonly label = "Blend Mode";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
    private readonly blendMode: BlendMode,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const track = findTrack(sequence, this.trackId);
    const clip = track.clips.find((c) => c.id === this.clipId);
    if (!clip) throw new Error("clip not found");
    const next: Clip = { ...clip, blendMode: this.blendMode };
    return updateSequence(
      project,
      mapTrack(sequence, this.trackId, () => ({
        ...track,
        clips: track.clips.map((c) => (c.id === clip.id ? next : c)),
      })),
    );
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("SetBlendModeCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

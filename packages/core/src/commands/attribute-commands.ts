/**
 * Copy / paste clip attributes (effects, blend, speed).
 */

import type { Project } from "../model/project.js";
import { requireActiveSequence, updateSequence } from "../model/project.js";
import type { Sequence } from "../model/sequence.js";
import type { Track } from "../model/track.js";
import type { Clip } from "../model/clip.js";
import type { EffectInstance } from "../model/effect.js";
import type { BlendMode } from "../model/enums.js";
import type { Command } from "./command.js";

export interface ClipAttributes {
  readonly effects: readonly EffectInstance[];
  readonly blendMode: BlendMode;
  readonly speed: number;
}

export function extractClipAttributes(clip: Clip): ClipAttributes {
  return {
    effects: clip.effects.map((e) => ({ ...e, params: { ...e.params } })),
    blendMode: clip.blendMode,
    speed: clip.speed,
  };
}

/** Pastes previously copied attributes onto a target clip. */
export class PasteAttributesCommand implements Command {
  readonly type = "clip.pasteAttributes";
  readonly label = "Paste Attributes";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
    private readonly attrs: ClipAttributes,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const map = (tracks: readonly Track[]): Track[] =>
      tracks.map((t) => {
        if (t.id !== this.trackId) return t;
        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === this.clipId
              ? {
                  ...c,
                  effects: this.attrs.effects,
                  blendMode: this.attrs.blendMode,
                  speed: this.attrs.speed,
                }
              : c,
          ),
        };
      });
    return updateSequence(project, {
      ...sequence,
      videoTracks: map(sequence.videoTracks),
      audioTracks: map(sequence.audioTracks),
      subtitleTracks: map(sequence.subtitleTracks),
    });
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("PasteAttributesCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

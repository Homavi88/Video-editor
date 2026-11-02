/**
 * Import subtitle cues onto a subtitle track as timeline clips.
 */

import type { Project } from "../model/project.js";
import { requireActiveSequence, updateSequence } from "../model/project.js";
import type { Sequence } from "../model/sequence.js";
import { createTrack } from "../model/track.js";
import { createClip } from "../model/clip.js";
import type { MediaItemId } from "../util/id.js";
import type { Command } from "./command.js";
import type { SubtitleCue } from "../text/subtitles.js";

/** Replaces subtitle track clips with one clip per cue (text in clip name). */
export class ImportSubtitleCuesCommand implements Command {
  readonly type = "timeline.importSubtitles";
  readonly label = "Import Subtitles";
  private before: Sequence | null = null;

  constructor(private readonly cues: readonly SubtitleCue[]) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    let tracks = [...sequence.subtitleTracks];
    if (tracks.length === 0) {
      tracks = [createTrack({ kind: "subtitle", name: "S1" })];
    }
    const track = tracks[0]!;
    const clips = this.cues
      .filter((c) => c.end > c.start)
      .map((cue) =>
        createClip({
          kind: "subtitle",
          source: { type: "generated", generatorId: "subtitle" },
          start: cue.start,
          duration: cue.end - cue.start,
          name: cue.text.replace(/\n/g, " ").slice(0, 80),
          label: "mint",
          effects: [],
        }),
      );
    const nextTrack = { ...track, clips };
    return updateSequence(project, {
      ...sequence,
      subtitleTracks: [nextTrack, ...tracks.slice(1)],
    });
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("ImportSubtitleCuesCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Replace selected clip's media source while keeping timeline placement. */
export class ReplaceClipMediaCommand implements Command {
  readonly type = "timeline.replaceMedia";
  readonly label = "Replace Clip";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
    private readonly mediaId: MediaItemId,
    private readonly name?: string,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const map = (tracks: typeof sequence.videoTracks) =>
      tracks.map((t) => {
        if (t.id !== this.trackId) return t;
        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === this.clipId
              ? {
                  ...c,
                  source: { type: "media" as const, mediaId: this.mediaId },
                  name: this.name ?? c.name,
                }
              : c,
          ),
        };
      });
    return updateSequence(project, {
      ...sequence,
      videoTracks: map(sequence.videoTracks),
      audioTracks: map(sequence.audioTracks),
    });
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("ReplaceClipMediaCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

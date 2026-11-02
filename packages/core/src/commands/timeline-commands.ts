import type { Project } from "../model/project.js";
import { requireActiveSequence, updateSequence } from "../model/project.js";
import type { Clip } from "../model/clip.js";
import type { Sequence } from "../model/sequence.js";
import type { Track } from "../model/track.js";
import { placeClip, splitClipAt } from "../model/track.js";
import type { Command } from "./command.js";

function replaceTrack(sequence: Sequence, trackId: string, next: Track): Sequence {
  const mapTracks = (tracks: readonly Track[]): Track[] =>
    tracks.map((t) => (t.id === trackId ? next : t));
  return {
    ...sequence,
    videoTracks: mapTracks(sequence.videoTracks),
    audioTracks: mapTracks(sequence.audioTracks),
    subtitleTracks: mapTracks(sequence.subtitleTracks),
  };
}

function findTrack(sequence: Sequence, trackId: string): Track {
  const track = [...sequence.videoTracks, ...sequence.audioTracks, ...sequence.subtitleTracks].find(
    (t) => t.id === trackId,
  );
  if (!track) throw new Error(`track ${trackId} not found`);
  return track;
}

/** Places a clip on a track using insert or overwrite semantics. */
export class PlaceClipCommand implements Command {
  readonly type = "timeline.placeClip";
  readonly label: string;
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clip: Clip,
    private readonly mode: "overwrite" | "insert",
  ) {
    this.label = mode === "insert" ? "Insert Clip" : "Overwrite Clip";
  }

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const track = findTrack(sequence, this.trackId);
    const nextTrack = placeClip(track, this.clip, this.mode);
    return updateSequence(project, replaceTrack(sequence, this.trackId, nextTrack));
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("PlaceClipCommand.undo called before execute");
    return updateSequence(project, this.before);
  }
}

/** Razor-tool split at a timeline time. */
export class SplitClipCommand implements Command {
  readonly type = "timeline.splitClip";
  readonly label = "Split Clip";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
    private readonly time: bigint,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const track = findTrack(sequence, this.trackId);
    const nextTrack = splitClipAt(track, this.clipId, this.time);
    return updateSequence(project, replaceTrack(sequence, this.trackId, nextTrack));
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("SplitClipCommand.undo called before execute");
    return updateSequence(project, this.before);
  }
}

/** Deletes a clip from a track without rippling (lift). */
export class LiftClipCommand implements Command {
  readonly type = "timeline.liftClip";
  readonly label = "Lift Clip";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const track = findTrack(sequence, this.trackId);
    const nextTrack: Track = {
      ...track,
      clips: track.clips.filter((c) => c.id !== this.clipId),
    };
    return updateSequence(project, replaceTrack(sequence, this.trackId, nextTrack));
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("LiftClipCommand.undo called before execute");
    return updateSequence(project, this.before);
  }
}

/** Renames the active sequence. */
export class RenameSequenceCommand implements Command {
  readonly type = "sequence.rename";
  readonly label = "Rename Sequence";
  private previousName: string | null = null;

  constructor(private readonly name: string) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.previousName = sequence.name;
    return updateSequence(project, { ...sequence, name: this.name });
  }

  undo(project: Project): Project {
    if (this.previousName === null) {
      throw new Error("RenameSequenceCommand.undo called before execute");
    }
    const sequence = requireActiveSequence(project);
    return updateSequence(project, { ...sequence, name: this.previousName });
  }
}

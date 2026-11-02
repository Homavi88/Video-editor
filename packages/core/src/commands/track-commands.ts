/**
 * Add / remove tracks and place adjustment-layer clips.
 */

import type { Project } from "../model/project.js";
import { requireActiveSequence, updateSequence } from "../model/project.js";
import type { Sequence } from "../model/sequence.js";
import { createTrack, type Track } from "../model/track.js";
import { createClip } from "../model/clip.js";
import type { Command } from "./command.js";
import type { TimeTicks } from "../util/time.js";
import type { TrackKind } from "../model/enums.js";

/** Adds an empty track of the given kind. */
export class AddTrackCommand implements Command {
  readonly type = "timeline.addTrack";
  readonly label = "Add Track";
  private before: Sequence | null = null;

  constructor(
    private readonly kind: TrackKind,
    private readonly name?: string,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    if (this.kind === "video") {
      const n = sequence.videoTracks.length + 1;
      const track = createTrack({ kind: "video", name: this.name ?? `V${n}` });
      // Keep Vn..V1 top-to-bottom: new highest layer first.
      return updateSequence(project, {
        ...sequence,
        videoTracks: [track, ...sequence.videoTracks],
      });
    }
    if (this.kind === "audio") {
      const n = sequence.audioTracks.length + 1;
      const track = createTrack({ kind: "audio", name: this.name ?? `A${n}` });
      return updateSequence(project, {
        ...sequence,
        audioTracks: [...sequence.audioTracks, track],
      });
    }
    if (this.kind === "adjustment") {
      const n = sequence.videoTracks.filter((t) => t.kind === "adjustment").length + 1;
      const track = createTrack({ kind: "adjustment", name: this.name ?? `ADJ${n}` });
      return updateSequence(project, {
        ...sequence,
        videoTracks: [track, ...sequence.videoTracks],
      });
    }
    const n = sequence.subtitleTracks.length + 1;
    const track = createTrack({
      kind: "subtitle",
      name: this.name ?? `S${n}`,
    });
    return updateSequence(project, {
      ...sequence,
      subtitleTracks: [...sequence.subtitleTracks, track],
    });
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("AddTrackCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Removes a track by id (clips are discarded). */
export class RemoveTrackCommand implements Command {
  readonly type = "timeline.removeTrack";
  readonly label = "Remove Track";
  private before: Sequence | null = null;

  constructor(private readonly trackId: string) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    return updateSequence(project, {
      ...sequence,
      videoTracks: sequence.videoTracks.filter((t) => t.id !== this.trackId),
      audioTracks: sequence.audioTracks.filter((t) => t.id !== this.trackId),
      subtitleTracks: sequence.subtitleTracks.filter((t) => t.id !== this.trackId),
    });
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("RemoveTrackCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Places a generated adjustment-layer clip spanning [start, start+duration). */
export class PlaceAdjustmentClipCommand implements Command {
  readonly type = "timeline.placeAdjustment";
  readonly label = "Adjustment Layer";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly start: TimeTicks,
    private readonly duration: TimeTicks,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const track = sequence.videoTracks.find((t) => t.id === this.trackId);
    if (!track) throw new Error("track not found");
    const clip = createClip({
      kind: "video",
      source: { type: "generated", generatorId: "adjustment" },
      start: this.start,
      duration: this.duration,
      name: "Adjustment Layer",
      label: "violet",
    });
    const next: Track = { ...track, clips: [...track.clips, clip] };
    return updateSequence(project, {
      ...sequence,
      videoTracks: sequence.videoTracks.map((t) => (t.id === track.id ? next : t)),
    });
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("PlaceAdjustmentClipCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Sets sequence In/Out for 3-point editing. */
export class SetSequenceInOutCommand implements Command {
  readonly type = "sequence.setInOut";
  readonly label = "Set In/Out";
  private before: Sequence | null = null;

  constructor(
    private readonly inPoint: TimeTicks | null,
    private readonly outPoint: TimeTicks | null,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    return updateSequence(project, {
      ...sequence,
      inPoint: this.inPoint,
      outPoint: this.outPoint,
    });
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("SetSequenceInOutCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

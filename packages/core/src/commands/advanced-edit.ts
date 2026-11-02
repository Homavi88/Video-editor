import type { Project } from "../model/project.js";
import { requireActiveSequence, updateSequence } from "../model/project.js";
import type { Sequence } from "../model/sequence.js";
import type { Track } from "../model/track.js";
import type { Clip } from "../model/clip.js";
import { clipEnd } from "../model/clip.js";
import type { Command } from "./command.js";
import type { TimeTicks } from "../util/time.js";
import { createId } from "../util/id.js";
import type { ColorLabel } from "../model/enums.js";

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

function findClip(track: Track, clipId: string): Clip {
  const clip = track.clips.find((c) => c.id === clipId);
  if (!clip) throw new Error(`clip ${clipId} not found`);
  return clip;
}

/** Ripple trim: change clip edge and shift subsequent clips on the same track. */
export class RippleTrimCommand implements Command {
  readonly type = "timeline.rippleTrim";
  readonly label = "Ripple Trim";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
    private readonly edge: "in" | "out",
    private readonly newEdgeTime: TimeTicks,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const track = findTrack(sequence, this.trackId);
    const clip = findClip(track, this.clipId);
    let delta: TimeTicks = 0n;
    let nextClip: Clip = clip;

    if (this.edge === "in") {
      const newStart = this.newEdgeTime;
      if (newStart >= clipEnd(clip)) throw new RangeError("invalid ripple in");
      delta = newStart - clip.start;
      const newDur = clip.duration - delta;
      if (newDur <= 0n) throw new RangeError("clip would vanish");
      nextClip = {
        ...clip,
        start: newStart,
        duration: newDur,
        inPoint: clip.inPoint + scaleSource(clip, delta),
      };
    } else {
      const newEnd = this.newEdgeTime;
      if (newEnd <= clip.start) throw new RangeError("invalid ripple out");
      const newDur = newEnd - clip.start;
      delta = newDur - clip.duration;
      nextClip = {
        ...clip,
        duration: newDur,
        outPoint: clip.inPoint + scaleSource(clip, newDur),
      };
    }

    const clips = track.clips.map((c) => {
      if (c.id === clip.id) return nextClip;
      if (c.start >= clipEnd(clip)) return { ...c, start: c.start + delta };
      return c;
    });
    return updateSequence(project, mapTrack(sequence, this.trackId, () => ({ ...track, clips })));
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("RippleTrimCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Roll edit between two adjacent clips: move shared edit point. */
export class RollEditCommand implements Command {
  readonly type = "timeline.roll";
  readonly label = "Roll Edit";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly leftClipId: string,
    private readonly rightClipId: string,
    private readonly newEditTime: TimeTicks,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const track = findTrack(sequence, this.trackId);
    const left = findClip(track, this.leftClipId);
    const right = findClip(track, this.rightClipId);
    if (clipEnd(left) !== right.start) {
      throw new Error("roll requires adjacent clips");
    }
    const t = this.newEditTime;
    if (t <= left.start || t >= clipEnd(right)) throw new RangeError("roll out of range");
    const leftDur = t - left.start;
    const rightDur = clipEnd(right) - t;
    const nextLeft: Clip = {
      ...left,
      duration: leftDur,
      outPoint: left.inPoint + scaleSource(left, leftDur),
    };
    const nextRight: Clip = {
      ...right,
      start: t,
      duration: rightDur,
      inPoint: right.outPoint - scaleSource(right, rightDur),
    };
    const clips = track.clips.map((c) => {
      if (c.id === left.id) return nextLeft;
      if (c.id === right.id) return nextRight;
      return c;
    });
    return updateSequence(project, mapTrack(sequence, this.trackId, () => ({ ...track, clips })));
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("RollEditCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Slip: keep timeline footprint, slide source in/out. */
export class SlipEditCommand implements Command {
  readonly type = "timeline.slip";
  readonly label = "Slip Edit";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
    private readonly deltaSourceTicks: TimeTicks,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const track = findTrack(sequence, this.trackId);
    const clip = findClip(track, this.clipId);
    const next: Clip = {
      ...clip,
      inPoint: clip.inPoint + this.deltaSourceTicks,
      outPoint: clip.outPoint + this.deltaSourceTicks,
    };
    if (next.inPoint < 0n) throw new RangeError("slip past media start");
    return updateSequence(
      project,
      mapTrack(sequence, this.trackId, () => ({
        ...track,
        clips: track.clips.map((c) => (c.id === clip.id ? next : c)),
      })),
    );
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("SlipEditCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Slide: move clip in time, trimming neighbors to keep them adjacent when possible. */
export class SlideEditCommand implements Command {
  readonly type = "timeline.slide";
  readonly label = "Slide Edit";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
    private readonly newStart: TimeTicks,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const track = findTrack(sequence, this.trackId);
    const clip = findClip(track, this.clipId);
    const delta = this.newStart - clip.start;
    const next: Clip = { ...clip, start: this.newStart < 0n ? 0n : this.newStart };
    const clips = track.clips.map((c) => (c.id === clip.id ? next : c));
    void delta;
    return updateSequence(project, mapTrack(sequence, this.trackId, () => ({ ...track, clips })));
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("SlideEditCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Change clip speed while optionally keeping duration (pitch-unaware). */
export class SetClipSpeedCommand implements Command {
  readonly type = "timeline.setSpeed";
  readonly label = "Change Speed";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
    private readonly speed: number,
    private readonly ripple = false,
  ) {}

  execute(project: Project): Project {
    if (this.speed === 0) throw new RangeError("speed cannot be 0");
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const track = findTrack(sequence, this.trackId);
    const clip = findClip(track, this.clipId);
    const sourceSpan = clip.outPoint - clip.inPoint;
    const newDuration = BigInt(Math.max(1, Math.round(Number(sourceSpan) / Math.abs(this.speed))));
    const delta = newDuration - clip.duration;
    const next: Clip = { ...clip, speed: this.speed, duration: newDuration };
    const clips = track.clips.map((c) => {
      if (c.id === clip.id) return next;
      if (this.ripple && c.start >= clipEnd(clip)) return { ...c, start: c.start + delta };
      return c;
    });
    return updateSequence(project, mapTrack(sequence, this.trackId, () => ({ ...track, clips })));
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("SetClipSpeedCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Link/unlink a set of clips (A/V sync group). */
export class LinkClipsCommand implements Command {
  readonly type = "timeline.linkClips";
  readonly label: string;
  private before: Sequence | null = null;

  constructor(
    private readonly clipIds: readonly string[],
    private readonly link: boolean,
  ) {
    this.label = link ? "Link Clips" : "Unlink Clips";
  }

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const idSet = new Set(this.clipIds);
    const rewrite = (tracks: readonly Track[]): Track[] =>
      tracks.map((track) => ({
        ...track,
        clips: track.clips.map((c) => {
          if (!idSet.has(c.id)) return c;
          return {
            ...c,
            linkedClipIds: this.link
              ? this.clipIds.filter((id) => id !== c.id).map((id) => id as Clip["id"])
              : [],
          };
        }),
      }));
    return updateSequence(project, {
      ...sequence,
      videoTracks: rewrite(sequence.videoTracks),
      audioTracks: rewrite(sequence.audioTracks),
      subtitleTracks: rewrite(sequence.subtitleTracks),
    });
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("LinkClipsCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Add a marker on the active sequence. */
export class AddMarkerCommand implements Command {
  readonly type = "timeline.addMarker";
  readonly label = "Add Marker";
  private markerId: string | null = null;

  constructor(
    private readonly time: TimeTicks,
    private readonly name = "Marker",
    private readonly color: ColorLabel = "red",
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    const id = createId<"Marker">();
    this.markerId = id;
    return updateSequence(project, {
      ...sequence,
      markers: [
        ...sequence.markers,
        { id, time: this.time, duration: 0n, name: this.name, comment: "", label: this.color },
      ],
    });
  }

  undo(project: Project): Project {
    if (!this.markerId) throw new Error("AddMarkerCommand.undo before execute");
    const sequence = requireActiveSequence(project);
    return updateSequence(project, {
      ...sequence,
      markers: sequence.markers.filter((m) => m.id !== this.markerId),
    });
  }
}

function scaleSource(clip: Clip, timelineDuration: bigint): bigint {
  return BigInt(Math.round(Number(timelineDuration) * Math.abs(clip.speed)));
}

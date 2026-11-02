import type { Project } from "../model/project.js";
import { requireActiveSequence, touchProject, updateSequence } from "../model/project.js";
import type { Sequence } from "../model/sequence.js";
import type { Track } from "../model/track.js";
import type { Clip } from "../model/clip.js";
import { clipEnd } from "../model/clip.js";
import type { MediaItem } from "../model/media.js";
import type { Command } from "./command.js";
import type { TimeTicks } from "../util/time.js";

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

/** Moves a clip to a new start time (overwrite gaps; no auto-ripple). */
export class MoveClipCommand implements Command {
  readonly type = "timeline.moveClip";
  readonly label = "Move Clip";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
    private readonly newStart: TimeTicks,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const next = mapTrack(sequence, this.trackId, (track) => ({
      ...track,
      clips: track.clips.map((c) => (c.id === this.clipId ? { ...c, start: this.newStart } : c)),
    }));
    return updateSequence(project, next);
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("MoveClipCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Trims clip in/out by adjusting start/duration/inPoint/outPoint. */
export class TrimClipCommand implements Command {
  readonly type = "timeline.trimClip";
  readonly label = "Trim Clip";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
    private readonly patch: Partial<Pick<Clip, "start" | "duration" | "inPoint" | "outPoint">>,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const next = mapTrack(sequence, this.trackId, (track) => ({
      ...track,
      clips: track.clips.map((c) => {
        if (c.id !== this.clipId) return c;
        const merged = { ...c, ...this.patch };
        if (merged.duration <= 0n) throw new RangeError("duration must stay positive");
        if (merged.outPoint <= merged.inPoint) throw new RangeError("invalid in/out");
        return merged;
      }),
    }));
    return updateSequence(project, next);
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("TrimClipCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Extract (ripple delete): remove clip and close the gap. */
export class ExtractClipCommand implements Command {
  readonly type = "timeline.extractClip";
  readonly label = "Extract Clip";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly clipId: string,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const track = findTrack(sequence, this.trackId);
    const target = track.clips.find((c) => c.id === this.clipId);
    if (!target) throw new Error(`clip ${this.clipId} not found`);
    const gap = target.duration;
    const gapStart = target.start;
    const remaining = track.clips
      .filter((c) => c.id !== this.clipId)
      .map((c) => (c.start >= clipEnd(target) ? { ...c, start: c.start - gap } : c))
      .filter((c) => !(c.start >= gapStart && clipEnd(c) <= gapStart));
    const next = mapTrack(sequence, this.trackId, () => ({ ...track, clips: remaining }));
    return updateSequence(project, next);
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("ExtractClipCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/** Imports media items into the project pool. */
export class ImportMediaCommand implements Command {
  readonly type = "media.import";
  readonly label: string;
  private addedIds: string[] = [];

  constructor(private readonly items: readonly MediaItem[]) {
    this.label = items.length === 1 ? `Import ${items[0]!.name}` : `Import ${items.length} Items`;
  }

  execute(project: Project): Project {
    this.addedIds = this.items.map((i) => i.id);
    return touchProject(project, { media: [...project.media, ...this.items] });
  }

  undo(project: Project): Project {
    const drop = new Set(this.addedIds);
    return touchProject(project, { media: project.media.filter((m) => !drop.has(m.id)) });
  }
}

/** Sets track mute/solo/lock/hidden flags. */
export class SetTrackFlagsCommand implements Command {
  readonly type = "timeline.setTrackFlags";
  readonly label = "Track Flags";
  private before: Sequence | null = null;

  constructor(
    private readonly trackId: string,
    private readonly flags: Partial<Pick<Track, "muted" | "solo" | "locked" | "hidden" | "height" | "name">>,
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    return updateSequence(
      project,
      mapTrack(sequence, this.trackId, (t) => ({ ...t, ...this.flags })),
    );
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("SetTrackFlagsCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

/**
 * Snap helper: returns the nearest candidate time within `threshold` ticks, or the input.
 */
export function snapTime(
  time: TimeTicks,
  candidates: readonly TimeTicks[],
  threshold: TimeTicks,
): TimeTicks {
  let best = time;
  let bestDist = threshold + 1n;
  for (const c of candidates) {
    const dist = time > c ? time - c : c - time;
    if (dist <= threshold && dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

/** Collects snap candidates from a sequence (clip edges + markers + playhead). */
export function collectSnapTargets(sequence: Sequence, playhead?: TimeTicks): TimeTicks[] {
  const targets: TimeTicks[] = [0n];
  if (playhead !== undefined) targets.push(playhead);
  for (const marker of sequence.markers) targets.push(marker.time);
  for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
    for (const clip of track.clips) {
      targets.push(clip.start, clipEnd(clip));
    }
  }
  return targets;
}

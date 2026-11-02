/**
 * Multicam helpers: build a synced angle set and switch the active angle clip.
 */

import type { Project } from "../model/project.js";
import { requireActiveSequence, updateSequence } from "../model/project.js";
import type { Sequence } from "../model/sequence.js";
import type { Track } from "../model/track.js";
import { createClip, type Clip } from "../model/clip.js";
import type { MediaItem } from "../model/media.js";
import type { Command } from "./command.js";
import { PlaceClipCommand } from "./timeline-commands.js";
import { HistoryStack } from "./command.js";

export interface MulticamAngle {
  readonly mediaId: string;
  readonly name: string;
  readonly offsetTicks: bigint;
}

/** Syncs media items by aligning their in-points (timecode when present, else 0). */
export function buildMulticamAngles(media: readonly MediaItem[]): MulticamAngle[] {
  const videos = media.filter((m) => m.kind === "video" || m.metadata.hasVideo);
  return videos.map((m) => ({
    mediaId: m.id,
    name: m.name,
    offsetTicks: 0n,
  }));
}

/**
 * Places each angle on successive video tracks starting at `start`, same duration.
 * Returns a new project via HistoryStack push of PlaceClip commands.
 */
export function placeMulticamAngles(
  project: Project,
  angles: readonly MulticamAngle[],
  start: bigint,
  duration: bigint,
): Project {
  const history = new HistoryStack(project);
  const sequence = requireActiveSequence(project);
  const tracks = [...sequence.videoTracks].reverse(); // V1..Vn bottom-up
  angles.forEach((angle, i) => {
    const track = tracks[i];
    if (!track) return;
    const media = project.media.find((m) => m.id === angle.mediaId);
    if (!media) return;
    const clip = createClip({
      kind: "video",
      source: { type: "media", mediaId: media.id },
      start,
      duration,
      inPoint: angle.offsetTicks,
      outPoint: angle.offsetTicks + duration,
      name: `MC${i + 1}:${media.name}`,
      label: i === 0 ? "red" : i === 1 ? "mint" : "blue",
    });
    history.push(new PlaceClipCommand(track.id, clip, "overwrite"));
  });
  return history.current;
}

/** Enables only the chosen angle track (hides others in the multicam stack). */
export class SwitchMulticamAngleCommand implements Command {
  readonly type = "multicam.switchAngle";
  readonly label = "Switch Multicam Angle";
  private before: Sequence | null = null;

  constructor(
    private readonly angleIndex: number,
    private readonly trackIds: readonly string[],
  ) {}

  execute(project: Project): Project {
    const sequence = requireActiveSequence(project);
    this.before = sequence;
    const videoTracks = sequence.videoTracks.map((t) => {
      const idx = this.trackIds.indexOf(t.id);
      if (idx < 0) return t;
      return { ...t, hidden: idx !== this.angleIndex, muted: idx !== this.angleIndex };
    });
    return updateSequence(project, { ...sequence, videoTracks });
  }

  undo(project: Project): Project {
    if (!this.before) throw new Error("SwitchMulticamAngleCommand.undo before execute");
    return updateSequence(project, this.before);
  }
}

export function findMulticamStack(sequence: Sequence): {
  trackIds: string[];
  clips: Clip[];
} | null {
  const candidates = sequence.videoTracks.filter((t) =>
    t.clips.some((c) => c.name.startsWith("MC")),
  );
  if (candidates.length < 2) return null;
  return {
    trackIds: candidates.map((t) => t.id),
    clips: candidates.flatMap((t) => t.clips),
  };
}

export type { Track };

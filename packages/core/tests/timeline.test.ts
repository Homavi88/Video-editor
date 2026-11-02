import { describe, expect, it } from "vitest";
import { createProject, requireActiveSequence } from "../src/model/project.js";
import { createClip } from "../src/model/clip.js";
import { createMediaItem } from "../src/model/media.js";
import { HistoryStack } from "../src/commands/command.js";
import { LiftClipCommand, PlaceClipCommand, SplitClipCommand } from "../src/commands/timeline-commands.js";
import { secondsToTicks } from "../src/util/time.js";
import { asId } from "../src/util/id.js";

describe("timeline commands", () => {
  it("places, splits, undoes, and redoes clips", () => {
    let project = createProject({ name: "Test" });
    const media = createMediaItem({
      kind: "video",
      name: "clip.mp4",
      path: "/tmp/clip.mp4",
      metadata: {
        duration: secondsToTicks(10),
        width: 1920,
        height: 1080,
        hasVideo: true,
        hasAudio: true,
      },
    });
    project = {
      ...project,
      media: [media],
    };

    const sequence = requireActiveSequence(project);
    const trackId = sequence.videoTracks[sequence.videoTracks.length - 1]!.id;
    const history = new HistoryStack(project);

    const clip = createClip({
      kind: "video",
      source: { type: "media", mediaId: media.id },
      start: 0n,
      duration: secondsToTicks(4),
      name: "A",
    });

    history.push(new PlaceClipCommand(trackId, clip, "overwrite"));
    let seq = requireActiveSequence(history.current);
    let track = seq.videoTracks.find((t) => t.id === trackId)!;
    expect(track.clips).toHaveLength(1);

    const mid = secondsToTicks(2);
    history.push(new SplitClipCommand(trackId, clip.id, mid));
    seq = requireActiveSequence(history.current);
    track = seq.videoTracks.find((t) => t.id === trackId)!;
    expect(track.clips).toHaveLength(2);

    history.undo();
    seq = requireActiveSequence(history.current);
    track = seq.videoTracks.find((t) => t.id === trackId)!;
    expect(track.clips).toHaveLength(1);

    history.redo();
    seq = requireActiveSequence(history.current);
    track = seq.videoTracks.find((t) => t.id === trackId)!;
    expect(track.clips).toHaveLength(2);

    const firstId = track.clips[0]!.id;
    history.push(new LiftClipCommand(trackId, firstId));
    seq = requireActiveSequence(history.current);
    track = seq.videoTracks.find((t) => t.id === trackId)!;
    expect(track.clips).toHaveLength(1);
    expect(track.clips[0]!.id).not.toBe(asId(firstId));
  });
});

import { describe, expect, it } from "vitest";
import {
  HistoryStack,
  createProject,
  requireActiveSequence,
  secondsToTicks,
  parseSrt,
  ImportSubtitleCuesCommand,
  ReplaceClipMediaCommand,
  createMediaItem,
  createClip,
  ImportMediaCommand,
  PlaceClipCommand,
  FRAME_RATES,
} from "../src/index.js";

describe("subtitle + replace commands", () => {
  it("imports SRT cues onto a subtitle track", () => {
    const srt = `1
00:00:00,000 --> 00:00:01,500
Hello

2
00:00:02,000 --> 00:00:03,000
World
`;
    const cues = parseSrt(srt);
    const history = new HistoryStack(createProject({ name: "S" }));
    history.push(new ImportSubtitleCuesCommand(cues));
    const seq = requireActiveSequence(history.current);
    expect(seq.subtitleTracks.length).toBe(1);
    expect(seq.subtitleTracks[0]!.clips.length).toBe(2);
    expect(seq.subtitleTracks[0]!.clips[0]!.name).toContain("Hello");
  });

  it("replaces clip media", () => {
    const history = new HistoryStack(createProject({ name: "R" }));
    const a = createMediaItem({
      kind: "video",
      name: "a.mp4",
      path: "/tmp/a.mp4",
      metadata: {
        duration: secondsToTicks(3),
        width: 640,
        height: 360,
        frameRate: FRAME_RATES.fps25,
        hasVideo: true,
        hasAudio: false,
      },
    });
    const b = createMediaItem({
      kind: "video",
      name: "b.mp4",
      path: "/tmp/b.mp4",
      metadata: {
        duration: secondsToTicks(3),
        width: 640,
        height: 360,
        frameRate: FRAME_RATES.fps25,
        hasVideo: true,
        hasAudio: false,
      },
    });
    history.push(new ImportMediaCommand([a, b]));
    const trackId = requireActiveSequence(history.current).videoTracks.at(-1)!.id;
    const clip = createClip({
      kind: "video",
      source: { type: "media", mediaId: a.id },
      start: 0n,
      duration: secondsToTicks(2),
      name: "A",
    });
    history.push(new PlaceClipCommand(trackId, clip, "overwrite"));
    history.push(new ReplaceClipMediaCommand(trackId, clip.id, b.id, b.name));
    const next = requireActiveSequence(history.current)
      .videoTracks.flatMap((t) => t.clips)
      .find((c) => c.id === clip.id)!;
    expect(next.source.type).toBe("media");
    if (next.source.type === "media") expect(next.source.mediaId).toBe(b.id);
    expect(next.name).toBe("b.mp4");
  });
});

import { describe, expect, it } from "vitest";
import {
  HistoryStack,
  createProject,
  requireActiveSequence,
  secondsToTicks,
  AddTrackCommand,
  RemoveTrackCommand,
  PlaceAdjustmentClipCommand,
  SetSequenceInOutCommand,
  PasteAttributesCommand,
  extractClipAttributes,
  createClip,
  PlaceClipCommand,
  createMediaItem,
  ImportMediaCommand,
  AddEffectCommand,
  FRAME_RATES,
  createWarmDemoLut,
} from "../src/index.js";

describe("track + attribute commands", () => {
  it("adds video/audio/adjustment tracks and places adjustment clip", () => {
    const history = new HistoryStack(createProject({ name: "T" }));
    const before = requireActiveSequence(history.current).videoTracks.length;
    history.push(new AddTrackCommand("video"));
    expect(requireActiveSequence(history.current).videoTracks.length).toBe(before + 1);
    history.push(new AddTrackCommand("adjustment"));
    const seq = requireActiveSequence(history.current);
    const adj = seq.videoTracks.find((t) => t.kind === "adjustment");
    expect(adj).toBeTruthy();
    history.push(new PlaceAdjustmentClipCommand(adj!.id, 0n, secondsToTicks(4)));
    expect(
      requireActiveSequence(history.current).videoTracks.find((t) => t.id === adj!.id)!.clips
        .length,
    ).toBe(1);
    history.push(new SetSequenceInOutCommand(0n, secondsToTicks(2)));
    expect(requireActiveSequence(history.current).inPoint).toBe(0n);
    history.push(new RemoveTrackCommand(adj!.id));
    expect(
      requireActiveSequence(history.current).videoTracks.some((t) => t.id === adj!.id),
    ).toBe(false);
  });

  it("pastes attributes between clips", () => {
    const history = new HistoryStack(createProject({ name: "T" }));
    const media = createMediaItem({
      kind: "video",
      name: "x.mp4",
      path: "/tmp/x.mp4",
      metadata: {
        duration: secondsToTicks(5),
        width: 640,
        height: 360,
        frameRate: FRAME_RATES.fps25,
        hasVideo: true,
        hasAudio: false,
      },
    });
    history.push(new ImportMediaCommand([media]));
    const trackId = requireActiveSequence(history.current).videoTracks.at(-1)!.id;
    const clipA = createClip({
      kind: "video",
      source: { type: "media", mediaId: media.id },
      start: 0n,
      duration: secondsToTicks(2),
      name: "A",
    });
    const clipB = createClip({
      kind: "video",
      source: { type: "media", mediaId: media.id },
      start: secondsToTicks(2),
      duration: secondsToTicks(2),
      name: "B",
    });
    history.push(new PlaceClipCommand(trackId, clipA, "overwrite"));
    history.push(new PlaceClipCommand(trackId, clipB, "overwrite"));
    history.push(new AddEffectCommand(trackId, clipA.id, "builtin.sharpen"));
    const withFx = requireActiveSequence(history.current)
      .videoTracks.flatMap((t) => t.clips)
      .find((c) => c.id === clipA.id)!;
    const attrs = extractClipAttributes(withFx);
    history.push(new PasteAttributesCommand(trackId, clipB.id, attrs));
    const pasted = requireActiveSequence(history.current)
      .videoTracks.flatMap((t) => t.clips)
      .find((c) => c.id === clipB.id)!;
    expect(pasted.effects.some((e) => e.typeId === "builtin.sharpen")).toBe(true);
  });

  it("builds warm demo LUT", () => {
    const lut = createWarmDemoLut(5);
    expect(lut.size).toBe(5);
    expect(lut.data.length).toBe(5 * 5 * 5 * 3);
  });
});

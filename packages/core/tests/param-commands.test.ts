import { describe, expect, it } from "vitest";
import {
  HistoryStack,
  createProject,
  requireActiveSequence,
  secondsToTicks,
  createMediaItem,
  createClip,
  ImportMediaCommand,
  PlaceClipCommand,
  AddEffectCommand,
  SetEffectParamCommand,
  AddEffectKeyframeCommand,
  SetEffectEnabledCommand,
  sampleEffectParam,
  FRAME_RATES,
} from "../src/index.js";

describe("effect param commands", () => {
  it("sets params, keyframes, and enabled flag", () => {
    const history = new HistoryStack(createProject({ name: "P" }));
    const media = createMediaItem({
      kind: "video",
      name: "v.mp4",
      path: "/tmp/v.mp4",
      metadata: {
        duration: secondsToTicks(4),
        width: 640,
        height: 360,
        frameRate: FRAME_RATES.fps25,
        hasVideo: true,
        hasAudio: false,
      },
    });
    history.push(new ImportMediaCommand([media]));
    const trackId = requireActiveSequence(history.current).videoTracks.at(-1)!.id;
    const clip = createClip({
      kind: "video",
      source: { type: "media", mediaId: media.id },
      start: 0n,
      duration: secondsToTicks(4),
      name: "V",
    });
    history.push(new PlaceClipCommand(trackId, clip, "overwrite"));
    history.push(new AddEffectCommand(trackId, clip.id, "builtin.vignette"));
    const fx = requireActiveSequence(history.current)
      .videoTracks.flatMap((t) => t.clips)
      .find((c) => c.id === clip.id)!.effects[0]!;
    history.push(new SetEffectParamCommand(trackId, clip.id, fx.id, "amount", 80));
    let amount = requireActiveSequence(history.current)
      .videoTracks.flatMap((t) => t.clips)
      .find((c) => c.id === clip.id)!.effects[0]!.params.amount!;
    expect(sampleEffectParam(amount, 0n, 0)).toBe(80);

    history.push(
      new AddEffectKeyframeCommand(trackId, clip.id, fx.id, "amount", secondsToTicks(1), 10),
    );
    history.push(
      new AddEffectKeyframeCommand(trackId, clip.id, fx.id, "amount", secondsToTicks(2), 90),
    );
    amount = requireActiveSequence(history.current)
      .videoTracks.flatMap((t) => t.clips)
      .find((c) => c.id === clip.id)!.effects[0]!.params.amount!;
    expect(amount.mode).toBe("keyframes");
    const mid = sampleEffectParam(amount, secondsToTicks(1.5), 0);
    expect(mid).toBeGreaterThan(10);
    expect(mid).toBeLessThan(90);

    history.push(new SetEffectEnabledCommand(trackId, clip.id, fx.id, false));
    expect(
      requireActiveSequence(history.current)
        .videoTracks.flatMap((t) => t.clips)
        .find((c) => c.id === clip.id)!.effects[0]!.enabled,
    ).toBe(false);
  });
});

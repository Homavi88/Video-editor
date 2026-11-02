import { describe, expect, it, beforeEach } from "vitest";
import { useEditorStore } from "./editor-store";
import {
  requireActiveSequence,
  createMediaItem,
  secondsToTicks,
  FRAME_RATES,
} from "@lumina/core";

describe("editor store", () => {
  beforeEach(() => {
    const project = useEditorStore.getState().history.current;
    useEditorStore.getState().history.reset(project);
    useEditorStore.setState({
      selectedClipId: null,
      playheadTicks: 0n,
      playing: false,
      project,
    });
  });

  it("imports media and places a clip", () => {
    const store = useEditorStore.getState();
    const media = createMediaItem({
      kind: "video",
      name: "clip.mp4",
      path: "/tmp/clip.mp4",
      metadata: {
        duration: secondsToTicks(4),
        width: 1280,
        height: 720,
        frameRate: FRAME_RATES.fps25,
        hasVideo: true,
        hasAudio: false,
      },
    });
    store.importMediaItems([media]);
    const mediaId = useEditorStore.getState().project.media[0]!.id;
    const sequence = requireActiveSequence(useEditorStore.getState().project);
    const trackId = sequence.videoTracks[sequence.videoTracks.length - 1]!.id;
    store.dropMediaOnTimeline(mediaId, trackId, 0n);
    const next = requireActiveSequence(useEditorStore.getState().project);
    const track = next.videoTracks.find((t) => t.id === trackId)!;
    expect(track.clips.length).toBeGreaterThan(0);
    store.undo();
    const afterUndo = requireActiveSequence(useEditorStore.getState().project);
    const track2 = afterUndo.videoTracks.find((t) => t.id === trackId)!;
    expect(track2.clips.length).toBe(track.clips.length - 1);
  });

  it("adds tracks, places adjustment layer, copies attributes", () => {
    const store = useEditorStore.getState();
    const before = requireActiveSequence(useEditorStore.getState().project).videoTracks.length;
    store.addTrack("video");
    expect(requireActiveSequence(useEditorStore.getState().project).videoTracks.length).toBe(
      before + 1,
    );
    store.placeAdjustmentLayer();
    const seq = requireActiveSequence(useEditorStore.getState().project);
    const adj = seq.videoTracks.find((t) => t.kind === "adjustment");
    expect(adj).toBeTruthy();
    expect(adj!.clips.length).toBeGreaterThan(0);

    const media = createMediaItem({
      kind: "video",
      name: "a.mp4",
      path: "/tmp/a.mp4",
      metadata: {
        duration: secondsToTicks(3),
        width: 1280,
        height: 720,
        frameRate: FRAME_RATES.fps25,
        hasVideo: true,
        hasAudio: false,
      },
    });
    store.importMediaItems([media]);
    const mediaId = useEditorStore.getState().project.media.at(-1)!.id;
    const vTrack = requireActiveSequence(useEditorStore.getState().project).videoTracks.find(
      (t) => t.kind === "video",
    )!;
    store.dropMediaOnTimeline(mediaId, vTrack.id, 0n);
    const clipId = requireActiveSequence(useEditorStore.getState().project)
      .videoTracks.flatMap((t) => t.clips)
      .find((c) => c.source.type === "media")!.id;
    useEditorStore.setState({ selectedClipId: clipId });
    store.addEffectToSelected("builtin.vignette");
    store.copySelectedAttributes();
    expect(useEditorStore.getState().copiedAttributes?.effects.length).toBeGreaterThan(0);

    store.loadDemoLut();
    expect(useEditorStore.getState().activeLut?.size).toBe(17);

    useEditorStore.setState({ selectedMediaId: mediaId, sourceInSec: 0.5, sourceOutSec: 2 });
    store.threePointInsert();
    const after = requireActiveSequence(useEditorStore.getState().project);
    const placed = after.videoTracks
      .flatMap((t) => t.clips)
      .filter((c) => c.source.type === "media");
    expect(placed.some((c) => c.inPoint > 0n)).toBe(true);
  });
});

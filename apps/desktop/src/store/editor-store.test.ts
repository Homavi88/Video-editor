import { describe, expect, it, beforeEach } from "vitest";
import { useEditorStore } from "./editor-store";
import { requireActiveSequence } from "@lumina/core";

describe("editor store", () => {
  beforeEach(() => {
    const project = useEditorStore.getState().history.current;
    useEditorStore.getState().history.reset(project);
    useEditorStore.setState({
      selectedClipId: null,
      playheadTicks: 0n,
      playing: false,
    });
  });

  it("imports demo media and places a clip", () => {
    const store = useEditorStore.getState();
    store.addDemoMedia();
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
});

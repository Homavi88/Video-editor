import { describe, expect, it } from "vitest";
import {
  createProject,
  createMediaItem,
  secondsToTicks,
  FRAME_RATES,
  buildMulticamAngles,
  placeMulticamAngles,
  findMulticamStack,
  SwitchMulticamAngleCommand,
  HistoryStack,
  requireActiveSequence,
  exportAafLite,
  isWatchableMediaPath,
  classifyMediaKind,
} from "../src/index.js";

describe("multicam + aaf + watch helpers", () => {
  it("builds multicam angles and switches visibility", () => {
    let project = createProject({ name: "MC" });
    const a = createMediaItem({
      kind: "video",
      name: "camA.mp4",
      path: "/tmp/a.mp4",
      metadata: {
        duration: secondsToTicks(10),
        width: 1280,
        height: 720,
        frameRate: FRAME_RATES.fps25,
        hasVideo: true,
        hasAudio: false,
      },
    });
    const b = createMediaItem({
      kind: "video",
      name: "camB.mp4",
      path: "/tmp/b.mp4",
      metadata: {
        duration: secondsToTicks(10),
        width: 1280,
        height: 720,
        frameRate: FRAME_RATES.fps25,
        hasVideo: true,
        hasAudio: false,
      },
    });
    project = { ...project, media: [a, b] };
    const angles = buildMulticamAngles(project.media);
    expect(angles).toHaveLength(2);
    project = placeMulticamAngles(project, angles, 0n, secondsToTicks(8));
    const stack = findMulticamStack(requireActiveSequence(project));
    expect(stack?.trackIds.length).toBeGreaterThanOrEqual(2);
    const history = new HistoryStack(project);
    history.push(new SwitchMulticamAngleCommand(1, stack!.trackIds));
    const seq = requireActiveSequence(history.current);
    const visible = seq.videoTracks.filter((t) => stack!.trackIds.includes(t.id) && !t.hidden);
    expect(visible).toHaveLength(1);
  });

  it("exports aaf-lite xml and classifies watch paths", () => {
    const project = createProject({ name: "AAF" });
    const media = createMediaItem({
      kind: "video",
      name: "x.mp4",
      path: "/tmp/x.mp4",
      metadata: {
        duration: secondsToTicks(2),
        width: 640,
        height: 360,
        frameRate: FRAME_RATES.fps25,
        hasVideo: true,
        hasAudio: false,
      },
    });
    const xml = exportAafLite(requireActiveSequence(project), [media], "Test");
    expect(xml).toContain("<AafLite");
    expect(xml).toContain("Sequence");
    expect(isWatchableMediaPath("/data/clip.mov")).toBe(true);
    expect(classifyMediaKind("tone.wav")).toBe("audio");
    expect(classifyMediaKind("still.png")).toBe("image");
  });
});

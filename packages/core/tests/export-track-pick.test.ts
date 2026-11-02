import { describe, expect, it } from "vitest";
import {
  createProject,
  requireActiveSequence,
  createMediaItem,
  createClip,
  createTrack,
  secondsToTicks,
  exportEdl,
  FRAME_RATES,
} from "../src/index.js";

describe("interchange track pick", () => {
  it("exports clips from a higher track when bottom track is empty", () => {
    const media = createMediaItem({
      kind: "video",
      name: "Top.mp4",
      path: "/tmp/top.mp4",
      metadata: {
        duration: secondsToTicks(2),
        width: 640,
        height: 360,
        frameRate: FRAME_RATES.fps25,
        hasVideo: true,
        hasAudio: false,
      },
    });
    let project = createProject({ name: "Pick" });
    project = { ...project, media: [media] };
    const seq = requireActiveSequence(project);
    const top = createTrack({ kind: "video", name: "V2" });
    const bottom = seq.videoTracks[seq.videoTracks.length - 1]!;
    const withTop = {
      ...seq,
      videoTracks: [
        {
          ...top,
          clips: [
            createClip({
              kind: "video",
              source: { type: "media", mediaId: media.id },
              start: 0n,
              duration: secondsToTicks(1),
              name: "TopClip",
            }),
          ],
        },
        { ...bottom, clips: [] },
      ],
    };
    const edl = exportEdl(withTop, [media]);
    expect(edl).toContain("TopClip");
  });
});

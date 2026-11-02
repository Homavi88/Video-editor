import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {
  createProject,
  requireActiveSequence,
  createClip,
  createMediaItem,
  PlaceClipCommand,
  ApplyTransitionCommand,
  HistoryStack,
  secondsToTicks,
  FRAME_RATES,
} from "@lumina/core";
import { generateDemoMedia, buildSequenceExportCommand, exportSequence } from "../src/index.js";

describe("xfade export", () => {
  it("builds xfade filter when transitionOutId is set", async () => {
    const demo = await generateDemoMedia(path.join(os.tmpdir(), "lumina-xfade-demo"));
    let project = createProject({ name: "Xfade" });
    const media = createMediaItem({
      kind: "video",
      name: "bars.mp4",
      path: demo.video,
      metadata: {
        duration: secondsToTicks(8),
        width: 1280,
        height: 720,
        frameRate: FRAME_RATES.fps25,
        hasVideo: true,
        hasAudio: false,
      },
    });
    project = { ...project, media: [media] };
    const seq = requireActiveSequence(project);
    const trackId = seq.videoTracks[seq.videoTracks.length - 1]!.id;
    const history = new HistoryStack(project);
    const a = createClip({
      kind: "video",
      source: { type: "media", mediaId: media.id },
      start: 0n,
      duration: secondsToTicks(2),
      name: "A",
    });
    const b = createClip({
      kind: "video",
      source: { type: "media", mediaId: media.id },
      start: secondsToTicks(2),
      duration: secondsToTicks(2),
      inPoint: secondsToTicks(2),
      outPoint: secondsToTicks(4),
      name: "B",
    });
    history.push(new PlaceClipCommand(trackId, a, "overwrite"));
    history.push(new PlaceClipCommand(trackId, b, "overwrite"));
    history.push(new ApplyTransitionCommand(trackId, a.id, "crossDissolve", "out"));
    const sequence = requireActiveSequence(history.current);
    const cmd = buildSequenceExportCommand({
      sequence,
      media: history.current.media,
      outputPath: path.join(os.tmpdir(), "lumina-xfade-out.mp4"),
      mode: "concat",
    });
    const fc = cmd.args.join(" ");
    expect(fc).toContain("xfade=transition=fade");
    const out = path.join(os.tmpdir(), `lumina-xfade-${Date.now()}.mp4`);
    await exportSequence({
      sequence,
      media: history.current.media,
      outputPath: out,
      mode: "concat",
    });
    const st = await fs.stat(out);
    expect(st.size).toBeGreaterThan(1000);
  });
});

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProject, createClip, createMediaItem, requireActiveSequence, secondsToTicks, PlaceClipCommand, HistoryStack } from "@lumina/core";
import { generateDemoMedia, buildSequenceExportCommand, exportSequence } from "../src/index.js";

describe("sequence export", () => {
  it("builds and runs an ffmpeg export from demo media", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lumina-export-"));
    const demo = await generateDemoMedia(dir);
    let project = createProject({ name: "Export" });
    const media = createMediaItem({
      kind: "video",
      name: "bars.mp4",
      path: demo.video,
      metadata: {
        duration: secondsToTicks(8),
        width: 1280,
        height: 720,
        hasVideo: true,
        hasAudio: true,
      },
    });
    project = { ...project, media: [media] };
    const seq = requireActiveSequence(project);
    const trackId = seq.videoTracks[seq.videoTracks.length - 1]!.id;
    const history = new HistoryStack(project);
    const clip = createClip({
      kind: "video",
      source: { type: "media", mediaId: media.id },
      start: 0n,
      duration: secondsToTicks(2),
    });
    history.push(new PlaceClipCommand(trackId, clip, "overwrite"));
    const out = path.join(dir, "out.mp4");
    const cmd = buildSequenceExportCommand({
      sequence: requireActiveSequence(history.current),
      media: history.current.media,
      outputPath: out,
    });
    expect(cmd.args).toContain("-filter_complex");
    await exportSequence({
      sequence: requireActiveSequence(history.current),
      media: history.current.media,
      outputPath: out,
    });
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.statSync(out).size).toBeGreaterThan(1000);
    fs.rmSync(dir, { recursive: true, force: true });
  }, 60_000);
});

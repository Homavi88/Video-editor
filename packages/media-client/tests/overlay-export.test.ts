import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createProject,
  createClip,
  createMediaItem,
  requireActiveSequence,
  secondsToTicks,
  PlaceClipCommand,
  HistoryStack,
} from "@lumina/core";
import { generateDemoMedia, buildSequenceExportCommand, exportSequence } from "../src/index.js";

describe("overlay export", () => {
  it("builds overlay graph for two stacked clips and exports", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lumina-overlay-"));
    const demo = await generateDemoMedia(dir);
    let project = createProject({ name: "Overlay", createDefaultSequence: true });
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
    const vBottom = seq.videoTracks[seq.videoTracks.length - 1]!;
    const vTop = seq.videoTracks[seq.videoTracks.length - 2]!;
    const history = new HistoryStack(project);
    history.push(
      new PlaceClipCommand(
        vBottom.id,
        createClip({
          kind: "video",
          source: { type: "media", mediaId: media.id },
          start: 0n,
          duration: secondsToTicks(2),
          name: "A",
        }),
        "overwrite",
      ),
    );
    history.push(
      new PlaceClipCommand(
        vTop.id,
        createClip({
          kind: "video",
          source: { type: "media", mediaId: media.id },
          start: secondsToTicks(0.5),
          duration: secondsToTicks(1.5),
          name: "B",
        }),
        "overwrite",
      ),
    );

    const out = path.join(dir, "overlay.mp4");
    const cmd = buildSequenceExportCommand({
      sequence: requireActiveSequence(history.current),
      media: history.current.media,
      outputPath: out,
      mode: "overlay",
    });
    expect(cmd.description).toMatch(/Overlay/i);
    expect(cmd.args.join(" ")).toContain("overlay=");
    await exportSequence({
      sequence: requireActiveSequence(history.current),
      media: history.current.media,
      outputPath: out,
      mode: "overlay",
    });
    expect(fs.statSync(out).size).toBeGreaterThan(1000);
    fs.rmSync(dir, { recursive: true, force: true });
  }, 90_000);
});

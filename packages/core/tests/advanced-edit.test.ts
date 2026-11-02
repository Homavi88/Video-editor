import { describe, expect, it } from "vitest";
import { createProject, requireActiveSequence } from "../src/model/project.js";
import { createClip } from "../src/model/clip.js";
import { createMediaItem } from "../src/model/media.js";
import { HistoryStack } from "../src/commands/command.js";
import { PlaceClipCommand } from "../src/commands/timeline-commands.js";
import {
  RippleTrimCommand,
  SlipEditCommand,
  SetClipSpeedCommand,
  AddMarkerCommand,
} from "../src/commands/advanced-edit.js";
import { secondsToTicks } from "../src/util/time.js";
import { createRectMask, pointInMask } from "../src/model/mask.js";
import { exportEdl } from "../src/interchange/edl.js";
import { exportOtio } from "../src/interchange/otio.js";
import { shouldAutosave, createAutosaveSnapshot } from "../src/project/autosave.js";
import { getHotkeyPreset } from "../src/hotkeys/presets.js";
import { computeScopes } from "../src/color/scopes.js";
import { SimpleEQ } from "../src/audio/dsp.js";

describe("advanced editing + interchange", () => {
  it("ripple trims and slips", () => {
    let project = createProject({ name: "Adv" });
    const media = createMediaItem({
      kind: "video",
      name: "a.mp4",
      path: "/tmp/a.mp4",
      metadata: {
        duration: secondsToTicks(20),
        hasVideo: true,
        hasAudio: false,
        width: 1280,
        height: 720,
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
      duration: secondsToTicks(4),
    });
    history.push(new PlaceClipCommand(trackId, clip, "overwrite"));
    history.push(
      new RippleTrimCommand(trackId, clip.id, "out", secondsToTicks(3)),
    );
    let track = requireActiveSequence(history.current).videoTracks.find((t) => t.id === trackId)!;
    expect(track.clips[0]!.duration).toBe(secondsToTicks(3));
    history.push(new SlipEditCommand(trackId, clip.id, secondsToTicks(0.5)));
    track = requireActiveSequence(history.current).videoTracks.find((t) => t.id === trackId)!;
    expect(track.clips[0]!.inPoint).toBe(secondsToTicks(0.5));
    history.push(new SetClipSpeedCommand(trackId, clip.id, 2, true));
    track = requireActiveSequence(history.current).videoTracks.find((t) => t.id === trackId)!;
    expect(track.clips[0]!.speed).toBe(2);
    history.push(new AddMarkerCommand(secondsToTicks(1), "Hit"));
    expect(requireActiveSequence(history.current).markers).toHaveLength(1);
  });

  it("masks, scopes, eq, hotkeys, autosave, edl/otio", () => {
    const mask = createRectMask({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    expect(pointInMask(mask, 0.5, 0.5)).toBe(true);
    expect(pointInMask(mask, 0.01, 0.01)).toBe(false);

    const rgba = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 200;
      rgba[i + 1] = 20;
      rgba[i + 2] = 20;
      rgba[i + 3] = 255;
    }
    const scopes = computeScopes(rgba, 4, 4, 32);
    expect(scopes.histogram.reduce((a, b) => a + b, 0)).toBe(16);

    const eq = new SimpleEQ();
    eq.setGains(3, 0, -3);
    expect(eq.processSample(0.2)).not.toBe(0);

    expect(getHotkeyPreset("premiere").toolRazor).toBe("C");
    expect(shouldAutosave(null, 5)).toBe(true);

    const project = createProject({ name: "X" });
    const snap = createAutosaveSnapshot(project, "manual");
    expect(snap.json).toContain("X");

    const seq = requireActiveSequence(project);
    const media = createMediaItem({
      kind: "video",
      name: "ClipA.mp4",
      path: "/tmp/a.mp4",
      metadata: { duration: secondsToTicks(2), hasVideo: true, hasAudio: false },
    });
    const withClip = {
      ...project,
      media: [media],
      sequences: [
        {
          ...seq,
          videoTracks: seq.videoTracks.map((t, i) =>
            i === seq.videoTracks.length - 1
              ? {
                  ...t,
                  clips: [
                    createClip({
                      kind: "video",
                      source: { type: "media", mediaId: media.id },
                      start: 0n,
                      duration: secondsToTicks(1),
                      name: "A",
                    }),
                  ],
                }
              : t,
          ),
        },
      ],
    };
    const edl = exportEdl(withClip.sequences[0]!, withClip.media);
    expect(edl).toContain("TITLE:");
    const otio = exportOtio(withClip.sequences[0]!, withClip.media);
    expect(otio.OTIO_SCHEMA).toBe("Timeline.1");
  });
});

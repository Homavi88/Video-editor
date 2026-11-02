import { describe, expect, it } from "vitest";
import { createProject } from "../src/model/project.js";
import { createMediaItem } from "../src/model/media.js";
import { projectFromJson, projectToJson } from "../src/project/serialize.js";
import { secondsToTicks } from "../src/util/time.js";
import { migrateProjectDocument } from "../src/project/migrate.js";

describe("project serialization", () => {
  it("round-trips through JSON", () => {
    const project = createProject({ name: "Roundtrip" });
    const media = createMediaItem({
      kind: "image",
      name: "still.png",
      path: "media/still.png",
      metadata: {
        duration: secondsToTicks(5),
        width: 1280,
        height: 720,
        hasVideo: true,
        hasAudio: false,
      },
    });
    const withMedia = { ...project, media: [media] };
    const json = projectToJson(withMedia);
    const restored = projectFromJson(json);
    expect(restored.name).toBe("Roundtrip");
    expect(restored.media).toHaveLength(1);
    expect(restored.media[0]!.metadata.duration).toBe(secondsToTicks(5));
    expect(restored.sequences[0]!.frameRate).toEqual(project.sequences[0]!.frameRate);
  });

  it("rejects future format versions", () => {
    expect(() =>
      migrateProjectDocument({ formatVersion: 999, name: "Future" }),
    ).toThrow(/newer than this Lumina build/);
  });
});

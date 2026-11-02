import { describe, expect, it } from "vitest";
import { createSequence } from "../src/model/sequence.js";
import { createClip } from "../src/model/clip.js";
import { placeClip } from "../src/model/track.js";
import { asId } from "../src/util/id.js";
import { secondsToTicks } from "../src/util/time.js";
import { buildRenderGraph, topoSort } from "../src/render-graph/graph.js";
import { RenderCacheIndex, hashNodeInputs } from "../src/render-graph/cache.js";

describe("render graph", () => {
  it("builds a DAG for an active clip and topologically sorts it", () => {
    let sequence = createSequence({ videoTrackCount: 1, audioTrackCount: 0 });
    const track = sequence.videoTracks[0]!;
    const clip = createClip({
      kind: "video",
      source: { type: "media", mediaId: asId("m1") },
      start: 0n,
      duration: secondsToTicks(3),
    });
    sequence = {
      ...sequence,
      videoTracks: [placeClip(track, clip, "overwrite")],
    };

    const graph = buildRenderGraph(sequence, secondsToTicks(1));
    const ordered = topoSort(graph);
    expect(ordered.length).toBeGreaterThanOrEqual(3);
    expect(ordered[ordered.length - 1]!.kind).toBe("sequenceOutput");
    expect(ordered.some((n) => n.kind === "sourceDecode")).toBe(true);
    expect(ordered.some((n) => n.kind === "transform")).toBe(true);
  });

  it("invalidates downstream cache entries", () => {
    const cache = new RenderCacheIndex();
    const graph = {
      sequenceId: asId<"Sequence">("s"),
      time: 0n,
      outputId: "out",
      nodes: new Map([
        ["a", { id: "a", kind: "sourceDecode" as const, inputs: [], meta: { kind: "sourceDecode" as const, clipId: asId("c"), sourceTime: 0n } }],
        ["b", { id: "b", kind: "transform" as const, inputs: ["a"], meta: { kind: "transform" as const, clipId: asId("c") } }],
        ["out", { id: "out", kind: "sequenceOutput" as const, inputs: ["b"], meta: { kind: "sequenceOutput" as const, sequenceId: asId("s"), width: 1920, height: 1080 } }],
      ]),
    };
    cache.indexGraph(graph);
    const ha = hashNodeInputs("a", "sourceDecode", "{}", []);
    const hb = hashNodeInputs("b", "transform", "{}", [ha]);
    cache.put("a", ha);
    cache.put("b", hb);
    expect(cache.size).toBe(2);
    const removed = cache.invalidate("a");
    expect(removed.has("a")).toBe(true);
    expect(removed.has("b")).toBe(true);
    expect(cache.size).toBe(0);
  });
});

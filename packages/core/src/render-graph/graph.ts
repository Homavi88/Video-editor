import type { ClipId, EffectId, SequenceId, TrackId } from "../util/id.js";
import type { TimeTicks } from "../util/time.js";
import type { BlendMode } from "../model/enums.js";
import type { Sequence } from "../model/sequence.js";
import { clipEnd, timelineToSourceTime } from "../model/clip.js";

/**
 * Node kinds in the per-frame render DAG.
 *
 * Frame assembly (bottom → top for video):
 *   SourceDecode → EffectChain → Transform → TrackComposite → SequenceOutput
 * Transitions insert a TransitionMix node between overlapping clip outputs.
 */
export type RenderNodeKind =
  | "sourceDecode"
  | "effect"
  | "transform"
  | "transitionMix"
  | "trackComposite"
  | "sequenceOutput"
  | "audioSource"
  | "audioMix";

export type RenderNodeId = string;

export interface RenderNode {
  readonly id: RenderNodeId;
  readonly kind: RenderNodeKind;
  /** Upstream node ids (dependencies). */
  readonly inputs: readonly RenderNodeId[];
  readonly meta: RenderNodeMeta;
}

export type RenderNodeMeta =
  | {
      readonly kind: "sourceDecode";
      readonly clipId: ClipId;
      readonly sourceTime: TimeTicks;
      readonly mediaPathHint?: string;
    }
  | {
      readonly kind: "effect";
      readonly effectId: EffectId;
      readonly typeId: string;
      readonly clipId: ClipId;
    }
  | {
      readonly kind: "transform";
      readonly clipId: ClipId;
    }
  | {
      readonly kind: "transitionMix";
      readonly typeId: string;
      readonly progress: number;
    }
  | {
      readonly kind: "trackComposite";
      readonly trackId: TrackId;
      readonly blendMode: BlendMode;
    }
  | {
      readonly kind: "sequenceOutput";
      readonly sequenceId: SequenceId;
      readonly width: number;
      readonly height: number;
    }
  | {
      readonly kind: "audioSource";
      readonly clipId: ClipId;
      readonly sourceTime: TimeTicks;
    }
  | {
      readonly kind: "audioMix";
      readonly trackId: TrackId;
    };

/** Immutable render graph for one frame (or audio buffer window). */
export interface RenderGraph {
  readonly sequenceId: SequenceId;
  readonly time: TimeTicks;
  readonly nodes: ReadonlyMap<RenderNodeId, RenderNode>;
  readonly outputId: RenderNodeId;
}

/**
 * Builds a render DAG for `sequence` at timeline `time`.
 * Only enabled, unmuted, visible clips that cover `time` participate.
 */
export function buildRenderGraph(sequence: Sequence, time: TimeTicks): RenderGraph {
  const nodes = new Map<RenderNodeId, RenderNode>();
  const trackLayers: { nodeId: RenderNodeId; trackId: TrackId }[] = [];

  // Video: higher tracks (earlier in array) composite over lower ones.
  // We process bottom-up so the final composite order is correct.
  const videoBottomUp = [...sequence.videoTracks].reverse();

  for (const track of videoBottomUp) {
    if (track.hidden || track.muted) continue;
    const active = track.clips.filter(
      (c) => c.enabled && time >= c.start && time < clipEnd(c),
    );
    if (active.length === 0) continue;

    const clipOutputIds: RenderNodeId[] = [];
    for (const clip of active) {
      const sourceTime = timelineToSourceTime(clip, time);
      if (sourceTime === null) continue;

      const decodeId: RenderNodeId = `decode:${clip.id}`;
      nodes.set(decodeId, {
        id: decodeId,
        kind: "sourceDecode",
        inputs: [],
        meta: {
          kind: "sourceDecode",
          clipId: clip.id,
          sourceTime,
        },
      });

      let upstream: RenderNodeId = decodeId;
      for (const effect of clip.effects) {
        if (!effect.enabled) continue;
        const isTransform = effect.typeId === "builtin.transform";
        const nodeId: RenderNodeId = isTransform
          ? `transform:${clip.id}`
          : `effect:${effect.id}`;
        nodes.set(nodeId, {
          id: nodeId,
          kind: isTransform ? "transform" : "effect",
          inputs: [upstream],
          meta: isTransform
            ? { kind: "transform", clipId: clip.id }
            : {
                kind: "effect",
                effectId: effect.id,
                typeId: effect.typeId,
                clipId: clip.id,
              },
        });
        upstream = nodeId;
      }
      clipOutputIds.push(upstream);
    }

    if (clipOutputIds.length === 0) continue;

    // Multiple overlapping clips on one track: composite left-to-right.
    let trackUpstream: RenderNodeId = clipOutputIds[0]!;
    for (let i = 1; i < clipOutputIds.length; i += 1) {
      const mixId: RenderNodeId = `trackMix:${track.id}:${i}`;
      nodes.set(mixId, {
        id: mixId,
        kind: "trackComposite",
        inputs: [trackUpstream, clipOutputIds[i]!],
        meta: {
          kind: "trackComposite",
          trackId: track.id,
          blendMode: active[i]?.blendMode ?? "normal",
        },
      });
      trackUpstream = mixId;
    }

    const trackNodeId: RenderNodeId = `track:${track.id}`;
    nodes.set(trackNodeId, {
      id: trackNodeId,
      kind: "trackComposite",
      inputs: [trackUpstream],
      meta: {
        kind: "trackComposite",
        trackId: track.id,
        blendMode: "normal",
      },
    });
    trackLayers.push({ nodeId: trackNodeId, trackId: track.id });
  }

  let outputUpstream: RenderNodeId | null = null;
  for (const layer of trackLayers) {
    if (outputUpstream === null) {
      outputUpstream = layer.nodeId;
      continue;
    }
    const previous: RenderNodeId = outputUpstream;
    const mixId: RenderNodeId = `seqMix:${previous}:${layer.nodeId}`;
    nodes.set(mixId, {
      id: mixId,
      kind: "trackComposite",
      inputs: [previous, layer.nodeId],
      meta: {
        kind: "trackComposite",
        trackId: layer.trackId,
        blendMode: "normal",
      },
    });
    outputUpstream = mixId;
  }

  const outputId = `output:${sequence.id}`;
  nodes.set(outputId, {
    id: outputId,
    kind: "sequenceOutput",
    inputs: outputUpstream ? [outputUpstream] : [],
    meta: {
      kind: "sequenceOutput",
      sequenceId: sequence.id,
      width: sequence.width,
      height: sequence.height,
    },
  });

  return {
    sequenceId: sequence.id,
    time,
    nodes,
    outputId,
  };
}

/**
 * Topologically sorts the graph for execution. Throws on cycles.
 */
export function topoSort(graph: RenderGraph): RenderNode[] {
  const visited = new Set<RenderNodeId>();
  const stack = new Set<RenderNodeId>();
  const ordered: RenderNode[] = [];

  const visit = (id: RenderNodeId): void => {
    if (visited.has(id)) return;
    if (stack.has(id)) throw new Error(`render graph cycle at ${id}`);
    stack.add(id);
    const node = graph.nodes.get(id);
    if (!node) throw new Error(`missing render node ${id}`);
    for (const input of node.inputs) visit(input);
    stack.delete(id);
    visited.add(id);
    ordered.push(node);
  };

  visit(graph.outputId);
  return ordered;
}

import type { RenderGraph, RenderNodeId } from "./graph.js";

/** Cache key for a rendered node output (frame or audio block). */
export interface CacheKey {
  readonly nodeId: RenderNodeId;
  readonly contentHash: string;
}

/**
 * Content-addressable frame cache.
 * Engine backends store GPU textures / CPU buffers externally; this class only
 * tracks keys and invalidation sets.
 */
export class RenderCacheIndex {
  private readonly keys = new Set<string>();
  private readonly dependents = new Map<RenderNodeId, Set<RenderNodeId>>();

  /** Records that `nodeId` produced an output under `contentHash`. */
  put(nodeId: RenderNodeId, contentHash: string): void {
    this.keys.add(cacheKeyString(nodeId, contentHash));
  }

  has(nodeId: RenderNodeId, contentHash: string): boolean {
    return this.keys.has(cacheKeyString(nodeId, contentHash));
  }

  /**
   * Registers edge `from → to` so invalidating `from` also invalidates `to`.
   * Typically called once when a graph is built.
   */
  indexGraph(graph: RenderGraph): void {
    this.dependents.clear();
    for (const node of graph.nodes.values()) {
      for (const input of node.inputs) {
        let set = this.dependents.get(input);
        if (!set) {
          set = new Set();
          this.dependents.set(input, set);
        }
        set.add(node.id);
      }
    }
  }

  /**
   * Invalidates a node and all downstream dependents. Returns the set of
   * removed cache key prefixes (node ids).
   */
  invalidate(nodeId: RenderNodeId): Set<RenderNodeId> {
    const removed = new Set<RenderNodeId>();
    const queue: RenderNodeId[] = [nodeId];
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (removed.has(current)) continue;
      removed.add(current);
      for (const key of [...this.keys]) {
        if (key.startsWith(`${current}|`)) this.keys.delete(key);
      }
      const deps = this.dependents.get(current);
      if (deps) {
        for (const d of deps) queue.push(d);
      }
    }
    return removed;
  }

  clear(): void {
    this.keys.clear();
    this.dependents.clear();
  }

  get size(): number {
    return this.keys.size;
  }
}

function cacheKeyString(nodeId: RenderNodeId, contentHash: string): string {
  return `${nodeId}|${contentHash}`;
}

/**
 * Stable content hash inputs for a node: kind + meta + input hashes.
 * Real GPU fingerprinting is left to the native engine; this helper is for tests
 * and CPU fallback paths.
 */
export function hashNodeInputs(
  nodeId: RenderNodeId,
  kind: string,
  metaJson: string,
  inputHashes: readonly string[],
): string {
  const payload = `${nodeId}:${kind}:${metaJson}:${inputHashes.join(",")}`;
  return fnv1a(payload);
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

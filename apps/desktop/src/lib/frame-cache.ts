/**
 * Client-side LRU frame cache + prefetch for Program/Source monitors.
 * Quantizes seek time so 60 Hz RAF does not spam ffmpeg.
 */

import { fetchFrameObjectUrl } from "./media-api";

const MAX_ENTRIES = 48;
const cache = new Map<string, string>();

export function quantizeTime(seconds: number, fps = 12): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  const step = 1 / Math.max(1, fps);
  return Math.round(seconds / step) * step;
}

function key(path: string, t: number, w: number, h: number): string {
  return `${path}|${t.toFixed(4)}|${w}x${h}`;
}

function touch(k: string, url: string): string {
  if (cache.has(k)) cache.delete(k);
  cache.set(k, url);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    const doomed = cache.get(oldest);
    cache.delete(oldest);
    if (doomed) URL.revokeObjectURL(doomed);
  }
  return url;
}

/** Returns a cached object URL or fetches and stores one. */
export async function getCachedFrame(
  filePath: string,
  timeSeconds: number,
  width = 960,
  height = 540,
  fps = 12,
): Promise<string | null> {
  const t = quantizeTime(timeSeconds, fps);
  const k = key(filePath, t, width, height);
  const hit = cache.get(k);
  if (hit) {
    touch(k, hit);
    return hit;
  }
  const url = await fetchFrameObjectUrl(filePath, t, width, height);
  if (!url) return null;
  return touch(k, url);
}

/** Prefetch upcoming quantized frames without blocking UI. */
export function prefetchFrames(
  filePath: string,
  fromSeconds: number,
  count: number,
  width = 960,
  height = 540,
  fps = 12,
): void {
  const step = 1 / Math.max(1, fps);
  for (let i = 1; i <= count; i += 1) {
    void getCachedFrame(filePath, fromSeconds + i * step, width, height, fps);
  }
}

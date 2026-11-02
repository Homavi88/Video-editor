/**
 * Client for the Vite/Electron media API (probe, frames, demo, export, peaks…).
 */

import type { MediaItem, Sequence } from "@lumina/core";

export async function apiHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/health");
    return res.ok;
  } catch {
    return false;
  }
}

export async function listEncoders(): Promise<
  Array<{ id: string; label: string; available: boolean; videoCodecFlag: string }>
> {
  const res = await fetch("/api/encoders");
  if (!res.ok) return [];
  const data = (await res.json()) as {
    encoders: Array<{ id: string; label: string; available: boolean; videoCodecFlag: string }>;
  };
  return data.encoders;
}

export async function ensureDemoMedia(): Promise<{
  video: string;
  audio: string;
  image: string;
} | null> {
  try {
    const res = await fetch("/api/demo/ensure", { method: "POST" });
    if (!res.ok) return null;
    return (await res.json()) as { video: string; audio: string; image: string };
  } catch {
    return null;
  }
}

export async function probePath(filePath: string): Promise<{
  kind: string;
  metadata: Record<string, unknown>;
} | null> {
  try {
    const res = await fetch(`/api/probe?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) return null;
    return (await res.json()) as { kind: string; metadata: Record<string, unknown> };
  } catch {
    return null;
  }
}

export async function fetchFrameObjectUrl(
  filePath: string,
  timeSeconds: number,
  width = 960,
  height = 540,
): Promise<string | null> {
  try {
    const qs = new URLSearchParams({
      path: filePath,
      t: String(timeSeconds),
      w: String(width),
      h: String(height),
    });
    const res = await fetch(`/api/frame?${qs.toString()}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function fetchPeaks(
  filePath: string,
  buckets = 256,
): Promise<Float32Array | null> {
  try {
    const res = await fetch(
      `/api/peaks?path=${encodeURIComponent(filePath)}&buckets=${buckets}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { peaks: number[] };
    return Float32Array.from(data.peaks);
  } catch {
    return null;
  }
}

export async function requestProxy(filePath: string): Promise<string | null> {
  const res = await fetch("/api/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filePath }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { proxyPath: string };
  return data.proxyPath;
}

export async function requestFilmstrip(
  filePath: string,
  durationSeconds: number,
): Promise<string[]> {
  const res = await fetch(
    `/api/filmstrip?path=${encodeURIComponent(filePath)}&duration=${durationSeconds}&frames=8`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { frames: string[] };
  return data.frames;
}

export async function requestTranscription(filePath: string): Promise<{
  resultSrt: string | null;
  provider: string;
  error: string | null;
}> {
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filePath }),
  });
  const data = (await res.json()) as {
    resultSrt: string | null;
    provider: string;
    error: string | null;
  };
  return data;
}

export async function exportSequenceApi(input: {
  sequence: Sequence;
  media: readonly MediaItem[];
  outputPath: string;
  dryRun?: boolean;
  mode?: "concat" | "overlay";
}): Promise<{
  ok: boolean;
  args?: string[];
  description?: string;
  encoder?: string;
  error?: string;
}> {
  const body = JSON.stringify(input, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const data = (await res.json()) as {
    ok?: boolean;
    args?: string[];
    description?: string;
    encoder?: string;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error ?? res.statusText };
  return { ok: true, ...data };
}

export function isFileBacked(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}

/** HTTP URL for HTMLVideoElement / Audio / Range streaming via Vite media API. */
export function mediaStreamUrl(filePath: string): string {
  return `/api/stream?path=${encodeURIComponent(filePath)}`;
}

export async function scanWatchFolder(dir: string): Promise<string[]> {
  const res = await fetch(`/api/watch/scan?dir=${encodeURIComponent(dir)}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { files: string[] };
  return data.files ?? [];
}

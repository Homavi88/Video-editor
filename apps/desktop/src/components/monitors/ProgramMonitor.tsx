import { useEffect, useRef, useState } from "react";
import { t } from "@lumina/i18n";
import { WebGLPreviewRenderer } from "@lumina/effects";
import {
  ticksToSeconds,
  requireActiveSequence,
  timelineToSourceTime,
  clipEnd,
} from "@lumina/core";
import { formatTimecode, useEditorStore } from "../../store/editor-store";
import { fetchFrameObjectUrl, isFileBacked } from "../../lib/media-api";

export function ProgramMonitor() {
  const locale = useEditorStore((s) => s.locale);
  const playheadTicks = useEditorStore((s) => s.playheadTicks);
  const project = useEditorStore((s) => s.project);
  const revision = useEditorStore((s) => s.revision);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const rendererRef = useRef<WebGLPreviewRenderer | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const sequence = requireActiveSequence(project);
  const fps = sequence.frameRate.numerator / sequence.frameRate.denominator;

  const active = findActiveVideo(project, playheadTicks);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      rendererRef.current = new WebGLPreviewRenderer(canvas);
    } catch {
      rendererRef.current = null;
    }
    return () => {
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const run = async () => {
      if (active && isFileBacked(active.mediaPath)) {
        const url = await fetchFrameObjectUrl(
          active.mediaPath,
          ticksToSeconds(active.sourceTime),
          960,
          540,
        );
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (frameUrl) URL.revokeObjectURL(frameUrl);
        objectUrl = url;
        setFrameUrl(url);
        return;
      }
      // Fallback: procedural bars
      setFrameUrl(null);
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      if (!renderer || !canvas) return;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = Math.floor(rect.width);
        canvas.height = Math.max(1, Math.floor(rect.height - 28));
        renderer.resize(canvas.width, canvas.height);
      }
      renderer.drawColorBars(ticksToSeconds(playheadTicks));
    };

    void run();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playheadTicks, revision, active?.mediaPath, active?.sourceTime]);

  useEffect(() => {
    if (!frameUrl || !imgRef.current || !canvasRef.current || !rendererRef.current) return;
    const img = imgRef.current;
    const onLoad = () => {
      const canvas = canvasRef.current!;
      const renderer = rendererRef.current!;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = Math.floor(rect.width);
        canvas.height = Math.max(1, Math.floor(rect.height - 28));
        renderer.resize(canvas.width, canvas.height);
      }
      const off = document.createElement("canvas");
      off.width = img.naturalWidth || 960;
      off.height = img.naturalHeight || 540;
      const ctx = off.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, off.width, off.height);
      renderer.drawPixels(new Uint8Array(data.data.buffer), off.width, off.height, 1);
    };
    img.addEventListener("load", onLoad);
    if (img.complete) onLoad();
    return () => img.removeEventListener("load", onLoad);
  }, [frameUrl]);

  return (
    <section className="lum-panel flex flex-col min-h-0">
      <header className="flex items-center justify-between px-2 py-1.5 border-b border-line text-sm">
        <span>{t(locale, "panel.program")}</span>
        <span className="font-mono text-xs text-accent2">
          {formatTimecode(playheadTicks, Math.round(fps))}
          {active ? ` · ${active.name}` : " · black"}
        </span>
      </header>
      <div className="flex-1 min-h-0 bg-black/40 relative">
        <canvas ref={canvasRef} className="w-full h-full block" />
        {frameUrl ? (
          <img ref={imgRef} src={frameUrl} alt="" className="hidden" />
        ) : null}
      </div>
    </section>
  );
}

function findActiveVideo(
  project: ReturnType<typeof useEditorStore.getState>["project"],
  time: bigint,
): { mediaPath: string; sourceTime: bigint; name: string } | null {
  const sequence = requireActiveSequence(project);
  for (const track of sequence.videoTracks) {
    if (track.hidden || track.muted) continue;
    for (const clip of track.clips) {
      if (!clip.enabled || time < clip.start || time >= clipEnd(clip)) continue;
      const source = clip.source;
      if (source.type !== "media") continue;
      const media = project.media.find((m) => m.id === source.mediaId);
      if (!media) continue;
      const sourceTime = timelineToSourceTime(clip, time);
      if (sourceTime === null) continue;
      return {
        mediaPath: media.proxy?.path ?? media.path,
        sourceTime,
        name: clip.name,
      };
    }
  }
  return null;
}

import { useEffect, useRef, useState } from "react";
import { t } from "@lumina/i18n";
import { WebGLPreviewRenderer } from "@lumina/effects";
import { ticksToSeconds } from "@lumina/core";
import { useEditorStore } from "../../store/editor-store";
import { fetchFrameObjectUrl, isFileBacked } from "../../lib/media-api";

export function SourceMonitor() {
  const locale = useEditorStore((s) => s.locale);
  const project = useEditorStore((s) => s.project);
  const selectedMediaId = useEditorStore((s) => s.selectedMediaId);
  const sourceInSec = useEditorStore((s) => s.sourceInSec);
  const sourceOutSec = useEditorStore((s) => s.sourceOutSec);
  const setSourceInOut = useEditorStore((s) => s.setSourceInOut);
  const threePointInsert = useEditorStore((s) => s.threePointInsert);
  const placeSelectedMediaAtPlayhead = useEditorStore((s) => s.placeSelectedMediaAtPlayhead);
  const media = project.media.find((m) => m.id === selectedMediaId) ?? project.media[0];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const rendererRef = useRef<WebGLPreviewRenderer | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [scrubSec, setScrubSec] = useState(0);

  const mediaDur = media ? Math.max(0.1, ticksToSeconds(media.metadata.duration)) : 10;

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
    let revoked: string | null = null;
    let cancelled = false;

    const run = async () => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !renderer) return;
      const parent = canvas.parentElement?.getBoundingClientRect();
      if (parent) {
        canvas.width = Math.floor(parent.width);
        canvas.height = Math.max(1, Math.floor(parent.height - 36));
        renderer.resize(canvas.width, canvas.height);
      }

      if (media && isFileBacked(media.path) && media.kind !== "audio") {
        const url = await fetchFrameObjectUrl(media.path, scrubSec || 0, 640, 360);
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        setFrameUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        revoked = url;
        return;
      }
      setFrameUrl(null);
      renderer.drawColorBars(media?.kind === "audio" ? 0.5 : 1.7);
    };

    void run();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [media?.id, media?.kind, media?.path, scrubSec]);

  useEffect(() => {
    if (!frameUrl || !imgRef.current || !canvasRef.current || !rendererRef.current) return;
    const img = imgRef.current;
    const onLoad = () => {
      try {
        const canvas = canvasRef.current!;
        const renderer = rendererRef.current!;
        const parent = canvas.parentElement?.getBoundingClientRect();
        if (parent) {
          canvas.width = Math.floor(parent.width);
          canvas.height = Math.max(1, Math.floor(parent.height - 36));
          renderer.resize(canvas.width, canvas.height);
        }
        const off = document.createElement("canvas");
        off.width = img.naturalWidth || 640;
        off.height = img.naturalHeight || 360;
        const ctx = off.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, off.width, off.height);
        renderer.drawPixels(new Uint8Array(data.data.buffer), off.width, off.height, 1);
      } catch {
        // ignore
      }
    };
    img.addEventListener("load", onLoad);
    if (img.complete) onLoad();
    return () => img.removeEventListener("load", onLoad);
  }, [frameUrl]);

  return (
    <section className="lum-panel flex flex-col min-h-0">
      <header className="flex items-center justify-between px-2 py-1.5 border-b border-line text-sm">
        <span>{t(locale, "panel.source")}</span>
        <span className="text-xs text-muted truncate max-w-[12rem]">{media?.name ?? "—"}</span>
      </header>
      <div className="flex-1 min-h-0 bg-black/40">
        <canvas ref={canvasRef} className="w-full h-full block" />
        {frameUrl ? <img ref={imgRef} src={frameUrl} alt="" className="hidden" /> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1 px-2 py-1 border-t border-line text-xs">
        <button
          type="button"
          className="lum-btn"
          onClick={() => setSourceInOut("in", scrubSec)}
          title="Mark In"
        >
          I
        </button>
        <button
          type="button"
          className="lum-btn"
          onClick={() => setSourceInOut("out", scrubSec)}
          title="Mark Out"
        >
          O
        </button>
        <span className="font-mono text-muted">
          {sourceInSec.toFixed(2)}–{sourceOutSec.toFixed(2)}s
        </span>
        <button type="button" className="lum-btn-primary" onClick={() => threePointInsert()}>
          Insert
        </button>
        <button type="button" className="lum-btn" onClick={() => placeSelectedMediaAtPlayhead()}>
          Overwrite
        </button>
        <label className="flex items-center gap-1 text-muted ml-auto">
          Scrub
          <input
            type="range"
            min={0}
            max={mediaDur}
            step={0.04}
            value={Math.min(scrubSec, mediaDur)}
            onChange={(e) => setScrubSec(Number(e.target.value))}
            className="w-24"
          />
        </label>
      </div>
    </section>
  );
}

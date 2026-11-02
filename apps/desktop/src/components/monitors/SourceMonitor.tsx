import { useEffect, useRef } from "react";
import { t } from "@lumina/i18n";
import { WebGLPreviewRenderer } from "@lumina/effects";
import { useEditorStore } from "../../store/editor-store";

export function SourceMonitor() {
  const locale = useEditorStore((s) => s.locale);
  const project = useEditorStore((s) => s.project);
  const selectedMediaId = useEditorStore((s) => s.selectedMediaId);
  const media = project.media.find((m) => m.id === selectedMediaId) ?? project.media[0];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const renderer = new WebGLPreviewRenderer(canvas);
      const parent = canvas.parentElement?.getBoundingClientRect();
      if (parent) {
        canvas.width = Math.floor(parent.width);
        canvas.height = Math.max(1, Math.floor(parent.height));
        renderer.resize(canvas.width, canvas.height);
      }
      renderer.drawColorBars(media?.kind === "audio" ? 0.5 : 1.7);
    } catch {
      // WebGL may be unavailable in some CI environments — panel still mounts.
    }
  }, [media?.id, media?.kind]);

  return (
    <section className="lum-panel flex flex-col min-h-0">
      <header className="flex items-center justify-between px-2 py-1.5 border-b border-line text-sm">
        <span>{t(locale, "panel.source")}</span>
        <span className="text-xs text-muted truncate max-w-[12rem]">{media?.name ?? "—"}</span>
      </header>
      <div className="flex-1 min-h-0 bg-black/40">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </section>
  );
}

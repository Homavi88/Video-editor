import { useEffect, useRef } from "react";
import { t } from "@lumina/i18n";
import { WebGLPreviewRenderer } from "@lumina/effects";
import { ticksToSeconds, requireActiveSequence } from "@lumina/core";
import { formatTimecode, useEditorStore } from "../../store/editor-store";

export function ProgramMonitor() {
  const locale = useEditorStore((s) => s.locale);
  const playheadTicks = useEditorStore((s) => s.playheadTicks);
  const project = useEditorStore((s) => s.project);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLPreviewRenderer | null>(null);
  const sequence = requireActiveSequence(project);
  const fps = sequence.frameRate.numerator / sequence.frameRate.denominator;

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
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height - 28);
      canvas.width = w;
      canvas.height = Math.max(1, h);
      renderer.resize(canvas.width, canvas.height);
    }
    renderer.drawColorBars(ticksToSeconds(playheadTicks));
  }, [playheadTicks]);

  return (
    <section className="lum-panel flex flex-col min-h-0">
      <header className="flex items-center justify-between px-2 py-1.5 border-b border-line text-sm">
        <span>{t(locale, "panel.program")}</span>
        <span className="font-mono text-xs text-accent2">
          {formatTimecode(playheadTicks, Math.round(fps))}
        </span>
      </header>
      <div className="flex-1 min-h-0 bg-black/40 relative">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </section>
  );
}

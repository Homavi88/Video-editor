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
import { isFileBacked, mediaStreamUrl } from "../../lib/media-api";
import { getCachedFrame, prefetchFrames, quantizeTime } from "../../lib/frame-cache";
import { ContinuousPreview } from "../../lib/webcodecs-preview";
import {
  applyAdjustmentEffects,
  applyClipEffectsToRenderer,
} from "../../lib/apply-clip-effects";

const PREVIEW_FPS = 12;

function finishPreviewPass(
  renderer: WebGLPreviewRenderer,
  opts: {
    clip: import("@lumina/core").Clip | undefined;
    playheadTicks: bigint;
    previewMask: import("@lumina/core").MaskShape | null;
    adjustmentClips: readonly import("@lumina/core").Clip[];
    activeLut: import("@lumina/core").Lut3D | null;
    lutStrength: number;
    lutUploadedRef: { current: string | null };
    compareSplit: boolean;
  },
): void {
  if (opts.clip) applyClipEffectsToRenderer(renderer, opts.clip, opts.playheadTicks);
  if (opts.adjustmentClips.length) {
    applyAdjustmentEffects(renderer, opts.adjustmentClips, opts.playheadTicks);
  }
  if (opts.activeLut) {
    const key = `${opts.activeLut.title}|${opts.activeLut.size}|${opts.activeLut.data.length}`;
    if (opts.lutUploadedRef.current !== key) {
      renderer.setLut3D(opts.activeLut.size, opts.activeLut.data);
      opts.lutUploadedRef.current = key;
    }
    renderer.applyLut(opts.lutStrength, opts.compareSplit ? 0.5 : 0);
  } else if (opts.lutUploadedRef.current) {
    renderer.clearLut();
    opts.lutUploadedRef.current = null;
  }
  if (opts.previewMask) {
    renderer.applyRectMask(
      opts.previewMask.bounds,
      opts.previewMask.feather,
      opts.previewMask.inverted,
      opts.previewMask.kind === "ellipse" ? "ellipse" : "rect",
    );
  }
}

export function ProgramMonitor() {
  const locale = useEditorStore((s) => s.locale);
  const playheadTicks = useEditorStore((s) => s.playheadTicks);
  const playing = useEditorStore((s) => s.playing);
  const project = useEditorStore((s) => s.project);
  const revision = useEditorStore((s) => s.revision);
  const previewMask = useEditorStore((s) => s.previewMask);
  const titleOverlay = useEditorStore((s) => s.titleOverlay);
  const activeLut = useEditorStore((s) => s.activeLut);
  const lutStrength = useEditorStore((s) => s.lutStrength);
  const compareSplit = useEditorStore((s) => s.compareSplit);
  const showSafeZones = useEditorStore((s) => s.showSafeZones);
  const setShowSafeZones = useEditorStore((s) => s.setShowSafeZones);
  const activeSubtitleText = useEditorStore((s) => s.activeSubtitleText);
  const subtitleLine = activeSubtitleText();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const rendererRef = useRef<WebGLPreviewRenderer | null>(null);
  const continuousRef = useRef<ContinuousPreview | null>(null);
  const lutUploadedRef = useRef<string | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const lastKeyRef = useRef<string>("");
  const sequence = requireActiveSequence(project);
  const fps = sequence.frameRate.numerator / sequence.frameRate.denominator;

  const active = findActiveVideo(project, playheadTicks);
  const adjustmentClips = findAdjustmentClips(project, playheadTicks);
  const sourceSec = active ? ticksToSeconds(active.sourceTime) : 0;
  const quantized = quantizeTime(sourceSec, PREVIEW_FPS);
  const frameKey = active ? `${active.mediaPath}|${quantized}` : "";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      rendererRef.current = new WebGLPreviewRenderer(canvas);
    } catch {
      rendererRef.current = null;
    }
    continuousRef.current = new ContinuousPreview();
    return () => {
      continuousRef.current?.stop();
      rendererRef.current = null;
    };
  }, []);

  // Continuous WebCodecs/HTMLVideo path while playing.
  useEffect(() => {
    const preview = continuousRef.current;
    const renderer = rendererRef.current;
    if (!preview || !renderer) return;

    if (!playing || !active || !isFileBacked(active.mediaPath)) {
      preview.stop();
      return;
    }

    let cancelled = false;
    void (async () => {
      await preview.setSource(mediaStreamUrl(active.mediaPath), active.mediaPath);
      if (cancelled) return;
      await preview.seek(ticksToSeconds(active.sourceTime));
      if (cancelled) return;
      preview.start((source) => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.parentElement?.getBoundingClientRect();
        if (rect) {
          canvas.width = Math.floor(rect.width);
          canvas.height = Math.max(1, Math.floor(rect.height - 28));
          renderer.resize(canvas.width, canvas.height);
        }
        const blend = (active.blendMode === "multiply" ||
        active.blendMode === "screen" ||
        active.blendMode === "overlay" ||
        active.blendMode === "add"
          ? active.blendMode
          : "normal") as "normal" | "multiply" | "screen" | "overlay" | "add";
        renderer.drawImageSource(source, 1, blend);
        finishPreviewPass(renderer, {
          clip: active.clip,
          playheadTicks,
          previewMask,
          adjustmentClips,
          activeLut,
          lutStrength,
          lutUploadedRef,
          compareSplit,
        });
        if (source instanceof ImageBitmap) source.close();
      });
    })();

    return () => {
      cancelled = true;
      preview.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playing,
    active?.mediaPath,
    active?.clipId,
    revision,
    previewMask,
    playheadTicks,
    activeLut,
    lutStrength,
    adjustmentClips.length,
    compareSplit,
  ]);

  // Resync continuous decoder if it drifts from the timeline clock.
  useEffect(() => {
    if (!playing || !active) return;
    const preview = continuousRef.current;
    if (!preview) return;
    const want = ticksToSeconds(active.sourceTime);
    if (Math.abs(preview.currentTime() - want) > 0.35) {
      void preview.seek(want);
    }
  }, [playing, active, playheadTicks]);

  // Scrub / paused: ffmpeg frame cache.
  useEffect(() => {
    if (playing) return;
    let cancelled = false;

    const run = async () => {
      if (active && isFileBacked(active.mediaPath)) {
        if (frameKey === lastKeyRef.current && frameUrl) {
          prefetchFrames(active.mediaPath, quantized, 2, 960, 540, PREVIEW_FPS);
          return;
        }
        const url = await getCachedFrame(active.mediaPath, quantized, 960, 540, PREVIEW_FPS);
        if (cancelled || !url) return;
        lastKeyRef.current = frameKey;
        setFrameUrl(url);
        return;
      }
      lastKeyRef.current = "";
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey, revision, playing, playheadTicks]);

  useEffect(() => {
    if (playing || !frameUrl || !imgRef.current || !canvasRef.current || !rendererRef.current) return;
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
      const blend = (active?.blendMode === "multiply" ||
      active?.blendMode === "screen" ||
      active?.blendMode === "overlay" ||
      active?.blendMode === "add"
        ? active.blendMode
        : "normal") as "normal" | "multiply" | "screen" | "overlay" | "add";
      renderer.drawImageSource(img, 1, blend);
      finishPreviewPass(renderer, {
        clip: active?.clip,
        playheadTicks,
        previewMask,
        adjustmentClips,
        activeLut,
        lutStrength,
        lutUploadedRef,
        compareSplit,
      });
    };
    img.addEventListener("load", onLoad);
    if (img.complete) onLoad();
    return () => img.removeEventListener("load", onLoad);
  }, [
    frameUrl,
    previewMask,
    playing,
    active?.blendMode,
    active?.clip,
    playheadTicks,
    activeLut,
    lutStrength,
    adjustmentClips,
    compareSplit,
  ]);

  return (
    <section className="lum-panel flex flex-col min-h-0">
      <header className="flex items-center justify-between px-2 py-1.5 border-b border-line text-sm gap-2">
        <span>{t(locale, "panel.program")}</span>
        <button
          type="button"
          className={`lum-btn text-[10px] ${showSafeZones ? "border-accent text-accent" : ""}`}
          onClick={() => setShowSafeZones(!showSafeZones)}
        >
          Safe
        </button>
        <span className="font-mono text-xs text-accent2">
          {formatTimecode(playheadTicks, Math.round(fps))}
          {active ? ` · ${active.name}` : " · black"}
          {playing ? " · ▶ WebCodecs" : " · scrub"}
        </span>
      </header>
      <div className="flex-1 min-h-0 bg-black/40 relative">
        <canvas ref={canvasRef} className="w-full h-full block" />
        {frameUrl && !playing ? <img ref={imgRef} src={frameUrl} alt="" className="hidden" /> : null}
        {compareSplit && activeLut ? (
          <div className="absolute inset-0 pointer-events-none flex text-[10px] text-white/80">
            <div className="w-1/2 border-r border-white/50 pl-2 pt-1">Before</div>
            <div className="w-1/2 pl-2 pt-1">After</div>
          </div>
        ) : null}
        {showSafeZones ? (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-[5%] border border-white/35" />
            <div className="absolute inset-[10%] border border-white/55" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20" />
          </div>
        ) : null}
        {titleOverlay ? (
          <div className="absolute inset-x-0 bottom-[18%] text-center pointer-events-none">
            <div
              className="inline-block px-4 py-2 text-2xl font-display tracking-wide"
              style={{
                color: "#f4f1e8",
                textShadow: "0 2px 12px rgba(0,0,0,0.85)",
                background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.45), transparent)",
              }}
            >
              {titleOverlay}
            </div>
          </div>
        ) : null}
        {subtitleLine ? (
          <div className="absolute inset-x-0 bottom-[8%] text-center pointer-events-none px-6">
            <div
              className="inline-block max-w-[90%] px-3 py-1 text-sm"
              style={{
                color: "#fff",
                background: "rgba(0,0,0,0.65)",
                textShadow: "0 1px 2px rgba(0,0,0,0.9)",
              }}
            >
              {subtitleLine}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function findActiveVideo(
  project: ReturnType<typeof useEditorStore.getState>["project"],
  time: bigint,
): {
  mediaPath: string;
  sourceTime: bigint;
  name: string;
  clipId: string;
  blendMode: string;
  clipStartSec: number;
  clipInSec: number;
  speed: number;
  clip: import("@lumina/core").Clip;
} | null {
  const sequence = requireActiveSequence(project);
  // Bottom-up so lower tracks win when no true compositor pass yet;
  // skip adjustment tracks (generated) here — their FX stack is applied after.
  for (let i = sequence.videoTracks.length - 1; i >= 0; i -= 1) {
    const track = sequence.videoTracks[i]!;
    if (track.hidden || track.muted || track.kind === "adjustment") continue;
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
        clipId: clip.id,
        blendMode: clip.blendMode,
        clipStartSec: ticksToSeconds(clip.start),
        clipInSec: ticksToSeconds(clip.inPoint),
        speed: Math.abs(clip.speed) || 1,
        clip,
      };
    }
  }
  return null;
}

function findAdjustmentClips(
  project: ReturnType<typeof useEditorStore.getState>["project"],
  time: bigint,
): import("@lumina/core").Clip[] {
  const sequence = requireActiveSequence(project);
  const out: import("@lumina/core").Clip[] = [];
  for (const track of sequence.videoTracks) {
    if (track.kind !== "adjustment" || track.hidden || track.muted) continue;
    for (const clip of track.clips) {
      if (!clip.enabled || time < clip.start || time >= clipEnd(clip)) continue;
      out.push(clip);
    }
  }
  return out;
}

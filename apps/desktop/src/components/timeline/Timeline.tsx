import { useMemo, useRef } from "react";
import { t } from "@lumina/i18n";
import {
  requireActiveSequence,
  secondsToTicks,
  ticksToSeconds,
  clipEnd,
} from "@lumina/core";
import { formatTimecode, useEditorStore } from "../../store/editor-store";
import { Waveform } from "./Waveform";
import { Filmstrip } from "./Filmstrip";

export function Timeline() {
  const locale = useEditorStore((s) => s.locale);
  const project = useEditorStore((s) => s.project);
  const playheadTicks = useEditorStore((s) => s.playheadTicks);
  const zoom = useEditorStore((s) => s.zoom);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const tool = useEditorStore((s) => s.tool);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled);
  const setTool = useEditorStore((s) => s.setTool);
  const selectClip = useEditorStore((s) => s.selectClip);
  const dropMediaOnTimeline = useEditorStore((s) => s.dropMediaOnTimeline);
  const moveSelected = useEditorStore((s) => s.moveSelected);
  const splitAtPlayhead = useEditorStore((s) => s.splitAtPlayhead);
  const rippleTrimSelected = useEditorStore((s) => s.rippleTrimSelected);
  const rollSelectedEdit = useEditorStore((s) => s.rollSelectedEdit);
  const slipSelected = useEditorStore((s) => s.slipSelected);
  const slideSelected = useEditorStore((s) => s.slideSelected);
  const applyDefaultTransition = useEditorStore((s) => s.applyDefaultTransition);
  const trimSelected = useEditorStore((s) => s.trimSelected);
  const sequence = requireActiveSequence(project);
  const pxPerSecond = zoom;
  const tracks = useMemo(
    () => [...sequence.videoTracks, ...sequence.audioTracks],
    [sequence.audioTracks, sequence.videoTracks],
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const durationSeconds = Math.max(
    20,
    ...tracks.flatMap((tr) => tr.clips.map((c) => ticksToSeconds(clipEnd(c)))),
  );
  const widthPx = durationSeconds * pxPerSecond;

  const ticksFromClientX = (clientX: number): bigint => {
    const el = scrollRef.current;
    if (!el) return 0n;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft - 96;
    return secondsToTicks(Math.max(0, x / pxPerSecond));
  };

  return (
    <section className="lum-panel flex flex-col min-h-0">
      <header className="flex items-center gap-2 px-2 py-1.5 border-b border-line text-sm">
        <span className="font-medium">{t(locale, "panel.timeline")}</span>
        <span className="font-mono text-xs text-muted">{sequence.name}</span>
        <div className="flex-1" />
        <button type="button" className={`lum-btn ${tool === "select" ? "border-accent" : ""}`} onClick={() => setTool("select")}>
          V
        </button>
        <button type="button" className={`lum-btn ${tool === "razor" ? "border-accent" : ""}`} onClick={() => setTool("razor")}>
          C
        </button>
        <button type="button" className={`lum-btn ${tool === "ripple" ? "border-accent" : ""}`} onClick={() => setTool("ripple")}>
          Ripple
        </button>
        <button type="button" className={`lum-btn ${tool === "roll" ? "border-accent" : ""}`} onClick={() => setTool("roll")}>
          Roll
        </button>
        <button type="button" className={`lum-btn ${tool === "slip" ? "border-accent" : ""}`} onClick={() => setTool("slip")}>
          Slip
        </button>
        <button type="button" className={`lum-btn ${tool === "slide" ? "border-accent" : ""}`} onClick={() => setTool("slide")}>
          Slide
        </button>
        <button type="button" className="lum-btn" onClick={() => splitAtPlayhead()}>
          {t(locale, "action.split")}
        </button>
        <button type="button" className="lum-btn" onClick={() => applyDefaultTransition()}>
          Dissolve
        </button>
        <button
          type="button"
          className={`lum-btn ${snapEnabled ? "border-accent text-accent" : ""}`}
          onClick={() => setSnapEnabled(!snapEnabled)}
        >
          Snap
        </button>
        <label className="flex items-center gap-1 text-xs text-muted">
          Zoom
          <input
            type="range"
            min={20}
            max={300}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <span className="font-mono text-xs text-accent2">
          {formatTimecode(playheadTicks, Math.round(sequence.frameRate.numerator / sequence.frameRate.denominator))}
        </span>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto lum-scroll relative"
        onClick={(e) => {
          if ((e.target as HTMLElement).dataset.ruler) {
            setPlayhead(ticksFromClientX(e.clientX));
          }
        }}
      >
        <div className="min-w-full" style={{ width: widthPx + 96 }}>
          <div
            data-ruler="1"
            className="h-6 border-b border-line ml-24 relative cursor-ew-resize"
            style={{ width: widthPx }}
          >
            {Array.from({ length: Math.ceil(durationSeconds) + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 h-full border-l border-line/70 text-[10px] text-muted pl-0.5"
                style={{ left: i * pxPerSecond }}
              >
                {i}s
              </div>
            ))}
          </div>

          {tracks.map((track) => (
            <div
              key={track.id}
              className="flex border-b border-line/80"
              style={{ height: track.height }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const mediaId =
                  e.dataTransfer.getData("application/x-lumina-media") ||
                  e.dataTransfer.getData("text/plain");
                if (!mediaId) return;
                dropMediaOnTimeline(mediaId, track.id, ticksFromClientX(e.clientX));
              }}
            >
              <div className="w-24 shrink-0 border-r border-line px-2 py-1 text-xs bg-panel sticky left-0 z-10">
                <div className="font-medium truncate">{track.name}</div>
                <div className="text-muted">{track.kind}{track.muted ? " · M" : ""}</div>
              </div>
              <div className="relative flex-1" style={{ width: widthPx }}>
                {track.clips.map((clip) => {
                  const left = ticksToSeconds(clip.start) * pxPerSecond;
                  const width = Math.max(4, ticksToSeconds(clip.duration) * pxPerSecond);
                  const selected = clip.id === selectedClipId;
                  const source = clip.source;
                  const mediaPath =
                    source.type === "media"
                      ? project.media.find((m) => m.id === source.mediaId)?.path
                      : undefined;
                  const hasDissolve = Boolean(clip.transitionOutId);
                  return (
                    <div
                      key={clip.id}
                      role="button"
                      tabIndex={0}
                      className={`absolute top-1 bottom-1 px-1.5 text-[11px] overflow-hidden border ${
                        track.kind === "audio" ? "bg-audio/70 border-audio" : "bg-clip/70 border-clip"
                      } ${selected ? "ring-2 ring-accent2" : ""} ${
                        tool === "select" ? "cursor-grab" : "cursor-ew-resize"
                      }`}
                      style={{ left, width }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectClip(clip.id);
                        if (tool === "razor") {
                          setPlayhead(ticksFromClientX(e.clientX));
                          splitAtPlayhead();
                        }
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        selectClip(clip.id);
                        const origin = ticksFromClientX(e.clientX);
                        const start0 = clip.start;
                        const end0 = clipEnd(clip);
                        const edgeZone = secondsToTicks(8 / pxPerSecond);
                        const nearIn = origin - clip.start < edgeZone;
                        const nearOut = end0 - origin < edgeZone;
                        let last = origin;

                        if (tool === "razor") return;

                        const onMove = (ev: PointerEvent) => {
                          const now = ticksFromClientX(ev.clientX);
                          last = now;
                          // Live preview only for select-move (coalesced enough for scrubbing).
                          if (tool === "select" && !nearIn && !nearOut) {
                            moveSelected(start0 + (now - origin));
                          }
                        };
                        const onUp = () => {
                          window.removeEventListener("pointermove", onMove);
                          window.removeEventListener("pointerup", onUp);
                          const delta = last - origin;
                          if (delta === 0n) return;
                          if (tool === "select") {
                            if (nearIn) {
                              const newStart = start0 + delta < 0n ? 0n : start0 + delta;
                              const newDur = end0 - newStart;
                              if (newDur > 0n) {
                                trimSelected({
                                  start: newStart,
                                  duration: newDur,
                                  inPoint: clip.inPoint + delta,
                                });
                              }
                            } else if (nearOut) {
                              const newEnd = end0 + delta;
                              if (newEnd > start0) {
                                trimSelected({
                                  duration: newEnd - start0,
                                  outPoint: clip.outPoint + delta,
                                });
                              }
                            }
                            // move already applied live
                            return;
                          }
                          if (tool === "ripple") {
                            const edge = nearIn ? "in" : "out";
                            rippleTrimSelected(edge, edge === "in" ? start0 + delta : end0 + delta);
                            return;
                          }
                          if (tool === "roll") {
                            rollSelectedEdit(nearIn ? start0 + delta : end0 + delta);
                            return;
                          }
                          if (tool === "slip") {
                            slipSelected(delta);
                            return;
                          }
                          if (tool === "slide") {
                            slideSelected(start0 + delta);
                          }
                        };
                        window.addEventListener("pointermove", onMove);
                        window.addEventListener("pointerup", onUp);
                      }}
                    >
                      {track.kind === "audio" && mediaPath ? (
                        <Waveform mediaPath={mediaPath} width={width} height={track.height - 8} />
                      ) : null}
                      {track.kind === "video" && mediaPath ? (
                        <Filmstrip
                          mediaPath={mediaPath}
                          durationSeconds={ticksToSeconds(clip.duration)}
                        />
                      ) : null}
                      <div className="truncate font-medium relative z-10 drop-shadow">{clip.name}</div>
                      {hasDissolve ? (
                        <div className="absolute right-0 top-0 bottom-0 w-3 bg-accent2/50 pointer-events-none" title="Cross Dissolve" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div
            className="absolute top-0 bottom-0 w-px bg-accent2 pointer-events-none z-20"
            style={{ left: 96 + ticksToSeconds(playheadTicks) * pxPerSecond }}
          />
        </div>
      </div>
    </section>
  );
}

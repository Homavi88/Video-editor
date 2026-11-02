import { useMemo, useState } from "react";
import {
  t,
} from "@lumina/i18n";
import {
  requireActiveSequence,
  ticksToSeconds,
  createRectMask,
  createEllipseMask,
  pointInMask,
  type MaskShape,
} from "@lumina/core";
import { useEditorStore } from "../../store/editor-store";
import { requestProxy, isFileBacked } from "../../lib/media-api";

export function Inspector() {
  const locale = useEditorStore((s) => s.locale);
  const project = useEditorStore((s) => s.project);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const selectedMediaId = useEditorStore((s) => s.selectedMediaId);
  const trimSelected = useEditorStore((s) => s.trimSelected);
  const setSelectedSpeed = useEditorStore((s) => s.setSelectedSpeed);
  const addMarkerAtPlayhead = useEditorStore((s) => s.addMarkerAtPlayhead);
  const [mask, setMask] = useState<MaskShape>(() => createRectMask());
  const [proxyStatus, setProxyStatus] = useState<string>("");
  const sequence = requireActiveSequence(project);

  const clip = [...sequence.videoTracks, ...sequence.audioTracks]
    .flatMap((tr) => tr.clips.map((c) => ({ clip: c, track: tr })))
    .find((x) => x.clip.id === selectedClipId);
  const media = project.media.find((m) => m.id === selectedMediaId);

  const maskPreview = useMemo(() => {
    const size = 64;
    const cells: boolean[] = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        cells.push(pointInMask(mask, (x + 0.5) / size, (y + 0.5) / size));
      }
    }
    return { size, cells };
  }, [mask]);

  return (
    <section className="lum-panel flex flex-col min-h-0">
      <header className="px-2 py-1.5 border-b border-line text-sm font-medium">
        {t(locale, "panel.inspector")}
      </header>
      <div className="flex-1 overflow-auto lum-scroll p-2 text-sm space-y-3">
        {clip ? (
          <div className="space-y-2">
            <div className="text-muted text-xs uppercase tracking-wide">Clip</div>
            <Field label="Name" value={clip.clip.name} />
            <Field label="Track" value={clip.track.name} />
            <Field label="Start" value={`${ticksToSeconds(clip.clip.start).toFixed(2)}s`} />
            <Field label="Duration" value={`${ticksToSeconds(clip.clip.duration).toFixed(2)}s`} />
            <Field label="Speed" value={`${clip.clip.speed}x`} />
            <Field label="Blend" value={clip.clip.blendMode} />
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="lum-btn"
                onClick={() =>
                  trimSelected({
                    duration:
                      clip.clip.duration > 500000000n
                        ? clip.clip.duration / 2n
                        : clip.clip.duration,
                  })
                }
              >
                Halve duration
              </button>
              <button type="button" className="lum-btn" onClick={() => setSelectedSpeed(0.5)}>
                0.5x
              </button>
              <button type="button" className="lum-btn" onClick={() => setSelectedSpeed(1)}>
                1x
              </button>
              <button type="button" className="lum-btn" onClick={() => setSelectedSpeed(2)}>
                2x
              </button>
              <button type="button" className="lum-btn" onClick={() => addMarkerAtPlayhead()}>
                Marker
              </button>
            </div>

            <div className="text-muted text-xs uppercase tracking-wide pt-2">Mask</div>
            <div className="flex gap-1">
              <button type="button" className="lum-btn" onClick={() => setMask(createRectMask())}>
                Rect
              </button>
              <button
                type="button"
                className="lum-btn"
                onClick={() => setMask(createEllipseMask())}
              >
                Ellipse
              </button>
              <button
                type="button"
                className="lum-btn"
                onClick={() => setMask({ ...mask, inverted: !mask.inverted })}
              >
                Invert
              </button>
            </div>
            <canvas
              width={maskPreview.size}
              height={maskPreview.size}
              className="border border-line w-full max-w-[160px] image-rendering-pixelated"
              ref={(canvas) => {
                if (!canvas) return;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                const img = ctx.createImageData(maskPreview.size, maskPreview.size);
                for (let i = 0; i < maskPreview.cells.length; i += 1) {
                  const on = maskPreview.cells[i]!;
                  const o = i * 4;
                  img.data[o] = on ? 61 : 20;
                  img.data[o + 1] = on ? 155 : 20;
                  img.data[o + 2] = on ? 253 : 28;
                  img.data[o + 3] = 255;
                }
                ctx.putImageData(img, 0, 0);
              }}
            />
            <div className="text-[11px] text-muted">
              {mask.kind} · feather {mask.feather}px · opacity {mask.opacity}
            </div>

            <div className="text-muted text-xs uppercase tracking-wide pt-2">Effects</div>
            {clip.clip.effects.map((fx) => (
              <div key={fx.id} className="border border-line px-2 py-1">
                {fx.typeId} {fx.enabled ? "" : "(off)"}
              </div>
            ))}
          </div>
        ) : media ? (
          <div className="space-y-2">
            <div className="text-muted text-xs uppercase tracking-wide">Media</div>
            <Field label="Name" value={media.name} />
            <Field label="Kind" value={media.kind} />
            <Field label="Path" value={media.path} />
            <Field
              label="Size"
              value={
                media.metadata.width
                  ? `${media.metadata.width}×${media.metadata.height}`
                  : "—"
              }
            />
            <Field
              label="Duration"
              value={`${ticksToSeconds(media.metadata.duration).toFixed(2)}s`}
            />
            {isFileBacked(media.path) && (
              <button
                type="button"
                className="lum-btn-primary"
                onClick={() => {
                  void (async () => {
                    setProxyStatus("Generating proxy…");
                    const proxy = await requestProxy(media.path);
                    setProxyStatus(proxy ? `Proxy: ${proxy}` : "Proxy failed");
                  })();
                }}
              >
                Generate proxy
              </button>
            )}
            {proxyStatus && <div className="text-[11px] text-muted break-all">{proxyStatus}</div>}
          </div>
        ) : (
          <p className="text-muted">Select a clip or media item.</p>
        )}
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2 items-start">
      <div className="text-muted text-xs pt-0.5">{label}</div>
      <div className="font-mono text-xs break-all">{value}</div>
    </div>
  );
}

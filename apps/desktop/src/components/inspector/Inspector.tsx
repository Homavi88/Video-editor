import { useEffect, useMemo, useState } from "react";
import { t } from "@lumina/i18n";
import {
  requireActiveSequence,
  ticksToSeconds,
  createRectMask,
  createEllipseMask,
  maskCoverage,
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
  const setPreviewMask = useEditorStore((s) => s.setPreviewMask);
  const attachProxyToMedia = useEditorStore((s) => s.attachProxyToMedia);
  const setSelectedBlendMode = useEditorStore((s) => s.setSelectedBlendMode);
  const copySelectedAttributes = useEditorStore((s) => s.copySelectedAttributes);
  const pasteAttributesToSelected = useEditorStore((s) => s.pasteAttributesToSelected);
  const copiedAttributes = useEditorStore((s) => s.copiedAttributes);
  const floatingInspector = useEditorStore((s) => s.floatingInspector);
  const setFloatingInspector = useEditorStore((s) => s.setFloatingInspector);
  const [mask, setMask] = useState<MaskShape>(() => createRectMask());
  const [proxyStatus, setProxyStatus] = useState<string>("");
  const sequence = requireActiveSequence(project);

  const clip = [...sequence.videoTracks, ...sequence.audioTracks]
    .flatMap((tr) => tr.clips.map((c) => ({ clip: c, track: tr })))
    .find((x) => x.clip.id === selectedClipId);
  const media = project.media.find((m) => m.id === selectedMediaId);

  useEffect(() => {
    setPreviewMask(clip ? mask : null);
  }, [clip, mask, setPreviewMask]);

  const maskPreview = useMemo(() => {
    const size = 64;
    const cells: number[] = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        cells.push(maskCoverage(mask, (x + 0.5) / size, (y + 0.5) / size, size));
      }
    }
    return { size, cells };
  }, [mask]);

  return (
    <section className="lum-panel flex flex-col min-h-0">
      <header className="flex items-center justify-between px-2 py-1.5 border-b border-line text-sm font-medium">
        <span>{t(locale, "panel.inspector")}</span>
        <button
          type="button"
          className={`lum-btn text-[10px] ${floatingInspector ? "border-accent text-accent" : ""}`}
          onClick={() => setFloatingInspector(!floatingInspector)}
        >
          {floatingInspector ? "Dock" : "Float"}
        </button>
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
            <label className="grid grid-cols-[88px_1fr] gap-2 items-center text-xs">
              <span className="text-muted">Blend</span>
              <select
                className="bg-transparent border border-line px-1 py-0.5"
                value={clip.clip.blendMode}
                onChange={(e) =>
                  setSelectedBlendMode(e.target.value as typeof clip.clip.blendMode)
                }
              >
                {(
                  [
                    "normal",
                    "multiply",
                    "screen",
                    "overlay",
                    "add",
                    "subtract",
                    "difference",
                    "hardLight",
                    "softLight",
                  ] as const
                ).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
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
              <button type="button" className="lum-btn" onClick={() => copySelectedAttributes()}>
                Copy attrs
              </button>
              <button
                type="button"
                className="lum-btn"
                disabled={!copiedAttributes}
                onClick={() => pasteAttributesToSelected()}
              >
                Paste attrs
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
            <label className="flex items-center gap-2 text-xs text-muted">
              Feather
              <input
                type="range"
                min={0}
                max={64}
                value={mask.feather}
                onChange={(e) => setMask({ ...mask, feather: Number(e.target.value) })}
              />
              <span className="font-mono w-8">{mask.feather}</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-muted">
              Expand
              <input
                type="range"
                min={-40}
                max={40}
                value={mask.expansion}
                onChange={(e) => setMask({ ...mask, expansion: Number(e.target.value) })}
              />
              <span className="font-mono w-8">{mask.expansion}</span>
            </label>
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
                  const a = maskPreview.cells[i]!;
                  const o = i * 4;
                  img.data[o] = Math.round(61 * a + 20 * (1 - a));
                  img.data[o + 1] = Math.round(155 * a + 20 * (1 - a));
                  img.data[o + 2] = Math.round(253 * a + 28 * (1 - a));
                  img.data[o + 3] = 255;
                }
                ctx.putImageData(img, 0, 0);
              }}
            />
            <div className="text-[11px] text-muted">
              {mask.kind}
              {mask.inverted ? " · inverted" : ""} · feather {mask.feather}px · expand{" "}
              {mask.expansion}px
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
            {media.proxy ? <Field label="Proxy" value={media.proxy.path} /> : null}
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
                    if (proxy) {
                      attachProxyToMedia(media.id, proxy);
                      setProxyStatus(`Proxy: ${proxy}`);
                    } else {
                      setProxyStatus("Proxy failed");
                    }
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

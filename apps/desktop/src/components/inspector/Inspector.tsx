import { t } from "@lumina/i18n";
import { requireActiveSequence, ticksToSeconds } from "@lumina/core";
import { useEditorStore } from "../../store/editor-store";

export function Inspector() {
  const locale = useEditorStore((s) => s.locale);
  const project = useEditorStore((s) => s.project);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const selectedMediaId = useEditorStore((s) => s.selectedMediaId);
  const trimSelected = useEditorStore((s) => s.trimSelected);
  const sequence = requireActiveSequence(project);

  const clip = [...sequence.videoTracks, ...sequence.audioTracks]
    .flatMap((tr) => tr.clips.map((c) => ({ clip: c, track: tr })))
    .find((x) => x.clip.id === selectedClipId);
  const media = project.media.find((m) => m.id === selectedMediaId);

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
            <div className="flex gap-1">
              <button
                type="button"
                className="lum-btn"
                onClick={() =>
                  trimSelected({
                    duration: clip.clip.duration > 500000000n ? clip.clip.duration / 2n : clip.clip.duration,
                  })
                }
              >
                Halve duration
              </button>
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
            <Field label="Duration" value={`${ticksToSeconds(media.metadata.duration).toFixed(2)}s`} />
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

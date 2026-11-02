import { useState } from "react";
import { EXPORT_PRESETS } from "@lumina/core";
import { t } from "@lumina/i18n";
import { useEditorStore } from "../../store/editor-store";

export function ExportPanel() {
  const locale = useEditorStore((s) => s.locale);
  const queue = useEditorStore((s) => s.exportQueue);
  const queueExport = useEditorStore((s) => s.queueExport);
  const status = useEditorStore((s) => s.status);
  const [presetId, setPresetId] = useState("youtube-4k");
  const [patentOk, setPatentOk] = useState(false);
  const preset = EXPORT_PRESETS.find((p) => p.id === presetId);

  return (
    <section className="lum-panel h-full grid grid-cols-[1fr_1fr] min-h-0">
      <div className="border-r border-line flex flex-col min-h-0">
        <header className="px-3 py-2 border-b border-line font-medium">
          {t(locale, "workspace.export")}
        </header>
        <div className="flex-1 overflow-auto lum-scroll p-3 space-y-2">
          {EXPORT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPresetId(p.id)}
              className={`w-full text-left border px-3 py-2 ${
                presetId === p.id ? "border-accent bg-accent/10" : "border-line"
              }`}
            >
              <div className="font-medium">{p.label}</div>
              <div className="text-xs text-muted">
                {p.description}
                {p.patentWarning ? " · patent" : ""}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 space-y-3 text-sm">
        {preset && (
          <>
            <h2 className="font-display text-2xl">{preset.label}</h2>
            <p className="text-muted">{preset.description}</p>
            <dl className="grid grid-cols-2 gap-2 font-mono text-xs">
              <div>Container: {preset.container}</div>
              <div>Video: {preset.videoCodec}</div>
              <div>Audio: {preset.audioCodec}</div>
              <div>
                Size: {preset.width}×{preset.height}
              </div>
              <div>RC: {preset.rateControl}{preset.crf !== undefined ? ` CRF ${preset.crf}` : ""}</div>
              <div>HW: {preset.hardwareHints.join(", ") || "software"}</div>
            </dl>
            {preset.patentWarning && (
              <label className="flex items-start gap-2 text-xs border border-accent2/40 p-2">
                <input
                  type="checkbox"
                  checked={patentOk}
                  onChange={(e) => setPatentOk(e.target.checked)}
                />
                <span>{t(locale, "patent.warning")}</span>
              </label>
            )}
            <button
              type="button"
              className="lum-btn-primary"
              onClick={() =>
                queueExport(preset.id, `~/Movies/Lumina/${preset.id}.${preset.container}`, patentOk)
              }
            >
              {t(locale, "action.export")} — queue
            </button>
          </>
        )}
        <div className="pt-4 border-t border-line">
          <div className="text-xs uppercase tracking-wide text-muted mb-2">Queue</div>
          {queue.length === 0 && <div className="text-muted text-xs">Empty</div>}
          {queue.map((job) => (
            <div key={job.id} className="border border-line px-2 py-1.5 mb-1 font-mono text-xs">
              {job.presetId} · {job.status} · {(job.progress * 100).toFixed(0)}%
              <div className="text-muted truncate">{job.outputPath}</div>
            </div>
          ))}
          <div className="text-xs text-muted mt-2">{status}</div>
        </div>
      </div>
    </section>
  );
}

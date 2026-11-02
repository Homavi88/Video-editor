import { gainToDb, requireActiveSequence } from "@lumina/core";
import { t } from "@lumina/i18n";
import { useEditorStore } from "../../store/editor-store";

export function MixerPanel() {
  const locale = useEditorStore((s) => s.locale);
  const project = useEditorStore((s) => s.project);
  const toggleTrackMute = useEditorStore((s) => s.toggleTrackMute);
  const sequence = requireActiveSequence(project);

  return (
    <section className="lum-panel flex flex-col min-h-0">
      <header className="px-2 py-1.5 border-b border-line text-sm font-medium">
        {t(locale, "panel.mixer")}
      </header>
      <div className="flex-1 overflow-auto lum-scroll p-3 flex gap-3">
        {sequence.audioTracks.map((track, i) => {
          const level = track.muted ? 0 : 0.55 - i * 0.08;
          return (
            <div key={track.id} className="w-20 flex flex-col items-center gap-2 border border-line p-2">
              <div className="text-xs font-medium">{track.name}</div>
              <div className="h-40 w-3 bg-black/30 relative overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 right-0 bg-audio"
                  style={{ height: `${level * 100}%` }}
                />
              </div>
              <div className="font-mono text-[10px] text-muted">{gainToDb(level).toFixed(1)} dB</div>
              <button type="button" className="lum-btn w-full" onClick={() => toggleTrackMute(track.id)}>
                {track.muted ? "Unmute" : "Mute"}
              </button>
              <button type="button" className="lum-btn w-full opacity-70" disabled>
                Solo
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

import { gainToDb, requireActiveSequence } from "@lumina/core";
import { t } from "@lumina/i18n";
import { useEditorStore } from "../../store/editor-store";

export function MixerPanel() {
  const locale = useEditorStore((s) => s.locale);
  const project = useEditorStore((s) => s.project);
  const toggleTrackMute = useEditorStore((s) => s.toggleTrackMute);
  const toggleTrackSolo = useEditorStore((s) => s.toggleTrackSolo);
  const trackGains = useEditorStore((s) => s.trackGains);
  const setTrackGain = useEditorStore((s) => s.setTrackGain);
  const vuLevels = useEditorStore((s) => s.vuLevels);
  const sequence = requireActiveSequence(project);

  return (
    <section className="lum-panel flex flex-col min-h-0">
      <header className="px-2 py-1.5 border-b border-line text-sm font-medium">
        {t(locale, "panel.mixer")}
      </header>
      <div className="flex-1 overflow-auto lum-scroll p-3 flex gap-3">
        {sequence.audioTracks.map((track) => {
          const gain = trackGains[track.id] ?? 1;
          const level = vuLevels[track.id] ?? 0;
          const shown = track.muted ? 0 : level * gain;
          return (
            <div key={track.id} className="w-20 flex flex-col items-center gap-2 border border-line p-2">
              <div className="text-xs font-medium">{track.name}</div>
              <div className="h-40 w-3 bg-black/30 relative overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 right-0 bg-audio transition-[height] duration-75"
                  style={{ height: `${Math.min(1, shown) * 100}%` }}
                />
              </div>
              <div className="font-mono text-[10px] text-muted">{gainToDb(Math.max(0.0001, shown)).toFixed(1)} dB</div>
              <input
                type="range"
                min={0}
                max={200}
                value={Math.round(gain * 100)}
                onChange={(e) => setTrackGain(track.id, Number(e.target.value) / 100)}
                className="w-full"
                title="Fader"
              />
              <button type="button" className="lum-btn w-full" onClick={() => toggleTrackMute(track.id)}>
                {track.muted ? "Unmute" : "Mute"}
              </button>
              <button
                type="button"
                className={`lum-btn w-full ${track.solo ? "border-accent text-accent" : ""}`}
                onClick={() => toggleTrackSolo(track.id)}
              >
                Solo
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

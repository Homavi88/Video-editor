import { EFFECT_PRESETS, TRANSITION_PRESETS } from "@lumina/core";
import { t } from "@lumina/i18n";
import { useEditorStore } from "../../store/editor-store";

const LIVE_FX = new Set([
  "builtin.blur.gaussian",
  "builtin.vignette",
  "builtin.color.lgg",
  "builtin.filmGrain",
  "builtin.sharpen",
  "builtin.color.lut",
  "builtin.mosaic",
  "builtin.mirror",
  "builtin.noise",
  "builtin.chromaticAberration",
  "builtin.glow",
]);

export function EffectsPanel() {
  const locale = useEditorStore((s) => s.locale);
  const applyTransitionPreset = useEditorStore((s) => s.applyTransitionPreset);
  const addEffectToSelected = useEditorStore((s) => s.addEffectToSelected);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const transitionDurationSec = useEditorStore((s) => s.transitionDurationSec);
  const setTransitionDurationSec = useEditorStore((s) => s.setTransitionDurationSec);
  const placeAdjustmentLayer = useEditorStore((s) => s.placeAdjustmentLayer);
  const loadDemoLut = useEditorStore((s) => s.loadDemoLut);

  return (
    <section className="lum-panel flex flex-col min-h-0">
      <header className="px-2 py-1.5 border-b border-line text-sm font-medium">
        {t(locale, "panel.effects")}
      </header>
      <div className="flex-1 overflow-auto lum-scroll p-2 space-y-4 text-sm">
        <div className="flex flex-wrap gap-1">
          <button type="button" className="lum-btn" onClick={() => placeAdjustmentLayer()}>
            Adjustment layer
          </button>
          <button type="button" className="lum-btn" onClick={() => loadDemoLut()}>
            Warm LUT
          </button>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted mb-1">
            Video / Audio FX {selectedClipId ? "(click to add)" : "(select clip)"}
          </div>
          <div className="space-y-1">
            {EFFECT_PRESETS.map((fx) => (
              <button
                key={fx.typeId}
                type="button"
                className="w-full text-left border border-line px-2 py-1.5 hover:border-accent disabled:opacity-50"
                disabled={!selectedClipId}
                onClick={() => {
                  addEffectToSelected(fx.typeId);
                  if (fx.typeId === "builtin.color.lut") loadDemoLut();
                }}
              >
                <div className="font-medium">
                  {fx.label}
                  {LIVE_FX.has(fx.typeId) ? (
                    <span className="ml-2 text-[10px] text-accent2">live</span>
                  ) : null}
                </div>
                <div className="text-[11px] text-muted font-mono">
                  {fx.category} · {fx.typeId}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted mb-1">
            Transitions {selectedClipId ? "(apply on out)" : "(select a clip)"}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted mb-2">
            Duration
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.1}
              value={transitionDurationSec}
              onChange={(e) => setTransitionDurationSec(Number(e.target.value))}
            />
            <span className="font-mono w-10">{transitionDurationSec.toFixed(1)}s</span>
          </label>
          <div className="space-y-1">
            {TRANSITION_PRESETS.map((tr) => (
              <button
                key={tr.id}
                type="button"
                className="w-full text-left border border-line px-2 py-1.5 hover:border-accent"
                disabled={!selectedClipId}
                onClick={() => {
                  setTransitionDurationSec(tr.defaultSeconds);
                  applyTransitionPreset(tr.id);
                }}
              >
                <div className="font-medium">{tr.label}</div>
                <div className="text-[11px] text-muted">
                  {tr.category} · {tr.defaultSeconds}s
                  {tr.glTransition ? ` · ${tr.glTransition}` : ""}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

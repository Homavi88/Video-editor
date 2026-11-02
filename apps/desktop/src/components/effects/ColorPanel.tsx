import { useMemo, useState } from "react";
import { applyLiftGammaGain, applySaturation, applyExposure, IDENTITY_LGG } from "@lumina/core";
import { useEditorStore } from "../../store/editor-store";

export function ColorPanel() {
  const [lift, setLift] = useState(0);
  const [gamma, setGamma] = useState(0);
  const [gain, setGain] = useState(0);
  const [sat, setSat] = useState(1);
  const [exposure, setExposure] = useState(0);
  const status = useEditorStore((s) => s.status);

  const preview = useMemo(() => {
    const lgg = {
      lift: { ...IDENTITY_LGG.lift, master: lift },
      gamma: { ...IDENTITY_LGG.gamma, master: gamma },
      gain: { ...IDENTITY_LGG.gain, master: gain },
    };
    let [r, g, b] = applyLiftGammaGain(0.5, 0.4, 0.3, lgg);
    [r, g, b] = applyExposure(r, g, b, exposure);
    [r, g, b] = applySaturation(r, g, b, sat);
    return { r, g, b };
  }, [exposure, gain, gamma, lift, sat]);

  return (
    <section className="lum-panel flex flex-col min-h-0">
      <header className="px-2 py-1.5 border-b border-line text-sm font-medium">Color</header>
      <div className="p-3 space-y-3 text-sm">
        <div
          className="h-24 border border-line"
          style={{
            background: `rgb(${Math.round(preview.r * 255)} ${Math.round(preview.g * 255)} ${Math.round(preview.b * 255)})`,
          }}
        />
        <Slider label="Lift" value={lift} min={-1} max={1} step={0.01} onChange={setLift} />
        <Slider label="Gamma" value={gamma} min={-1} max={1} step={0.01} onChange={setGamma} />
        <Slider label="Gain" value={gain} min={-1} max={1} step={0.01} onChange={setGain} />
        <Slider label="Saturation" value={sat} min={0} max={3} step={0.01} onChange={setSat} />
        <Slider label="Exposure" value={exposure} min={-3} max={3} step={0.01} onChange={setExposure} />
        <div className="text-xs text-muted">Scopes: Waveform / Vectorscope / Parade ship as WebGL overlays in Stage 7 polish. Status: {status}</div>
      </div>
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="grid grid-cols-[88px_1fr_48px] gap-2 items-center text-xs">
      <span className="text-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="font-mono text-right">{value.toFixed(2)}</span>
    </label>
  );
}

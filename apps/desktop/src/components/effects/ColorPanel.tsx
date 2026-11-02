import { useMemo, useState } from "react";
import {
  applyLiftGammaGain,
  applySaturation,
  applyExposure,
  IDENTITY_LGG,
  computeScopes,
} from "@lumina/core";
import { useEditorStore } from "../../store/editor-store";

export function ColorPanel() {
  const [lift, setLift] = useState(0);
  const [gamma, setGamma] = useState(0);
  const [gain, setGain] = useState(0);
  const [sat, setSat] = useState(1);
  const [exposure, setExposure] = useState(0);
  const status = useEditorStore((s) => s.status);
  const activeLut = useEditorStore((s) => s.activeLut);
  const lutStrength = useEditorStore((s) => s.lutStrength);
  const loadDemoLut = useEditorStore((s) => s.loadDemoLut);
  const setLutStrength = useEditorStore((s) => s.setLutStrength);
  const setActiveLut = useEditorStore((s) => s.setActiveLut);
  const loadCubeLutText = useEditorStore((s) => s.loadCubeLutText);
  const addEffectToSelected = useEditorStore((s) => s.addEffectToSelected);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const compareSplit = useEditorStore((s) => s.compareSplit);
  const setCompareSplit = useEditorStore((s) => s.setCompareSplit);

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

  const hist = useMemo(() => {
    const rgba = new Uint8Array(64 * 36 * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = Math.round(preview.r * 255);
      rgba[i + 1] = Math.round(preview.g * 255);
      rgba[i + 2] = Math.round(preview.b * 255);
      rgba[i + 3] = 255;
    }
    return computeScopes(rgba, 64, 36, 64);
  }, [preview]);

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

        <div className="text-xs uppercase tracking-wide text-muted pt-1">LUT</div>
        <div className="flex flex-wrap gap-1">
          <button type="button" className="lum-btn-primary" onClick={() => loadDemoLut()}>
            Load warm demo LUT
          </button>
          <label className="lum-btn cursor-pointer">
            Import .cube
            <input
              type="file"
              accept=".cube,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void file.text().then((text) => loadCubeLutText(text));
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="lum-btn"
            disabled={!activeLut}
            onClick={() => setActiveLut(null)}
          >
            Clear LUT
          </button>
          <button
            type="button"
            className="lum-btn"
            disabled={!selectedClipId}
            onClick={() => {
              loadDemoLut();
              addEffectToSelected("builtin.color.lut");
            }}
          >
            Add LUT FX to clip
          </button>
          <button
            type="button"
            className={`lum-btn ${compareSplit ? "border-accent text-accent" : ""}`}
            onClick={() => setCompareSplit(!compareSplit)}
          >
            Before/After
          </button>
        </div>
        <div className="text-[11px] text-muted">
          {activeLut
            ? `${activeLut.title} · ${activeLut.size}³ · strength ${(lutStrength * 100).toFixed(0)}%`
            : "No LUT — Program preview uses identity"}
        </div>
        <Slider
          label="LUT strength"
          value={lutStrength}
          min={0}
          max={1}
          step={0.01}
          onChange={setLutStrength}
        />

        <div className="text-xs text-muted">
          Histogram peak bin:{" "}
          {hist.histogram.indexOf(Math.max(...hist.histogram))} · Status: {status}
        </div>
        <canvas
          width={128}
          height={48}
          className="w-full border border-line bg-black/40"
          ref={(canvas) => {
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(0, 0, 128, 48);
            const max = Math.max(1, ...hist.histogram);
            ctx.fillStyle = "#3d9bfd";
            for (let i = 0; i < 256; i += 2) {
              const h = (hist.histogram[i]! / max) * 48;
              ctx.fillRect(i / 2, 48 - h, 1, h);
            }
          }}
        />
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

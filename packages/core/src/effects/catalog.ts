/**
 * Built-in video/audio effect registry (domain metadata).
 * Shader / DSP implementations live in `@lumina/effects` and the native engine.
 */

import type { EffectParamDescriptor } from "../model/effect.js";

export type EffectCategory =
  | "blur"
  | "stylize"
  | "distort"
  | "color"
  | "keying"
  | "generate"
  | "audio"
  | "transform"
  | "time";

export interface EffectPreset {
  readonly typeId: string;
  readonly label: string;
  readonly category: EffectCategory;
  readonly params: readonly EffectParamDescriptor[];
}

const num = (
  key: string,
  label: string,
  defaultValue: number,
  min: number,
  max: number,
  step = 0.1,
): EffectParamDescriptor => ({
  key,
  label,
  type: "number",
  defaultValue,
  min,
  max,
  step,
  animatable: true,
});

export const EFFECT_PRESETS: readonly EffectPreset[] = [
  {
    typeId: "builtin.transform",
    label: "Transform",
    category: "transform",
    params: [
      num("positionX", "Position X", 0, -4096, 4096, 1),
      num("positionY", "Position Y", 0, -4096, 4096, 1),
      num("scaleX", "Scale X", 100, 0, 1000, 0.1),
      num("scaleY", "Scale Y", 100, 0, 1000, 0.1),
      num("rotation", "Rotation", 0, -3600, 3600, 0.1),
      num("opacity", "Opacity", 100, 0, 100, 0.1),
    ],
  },
  {
    typeId: "builtin.blur.gaussian",
    label: "Gaussian Blur",
    category: "blur",
    params: [num("radius", "Radius", 10, 0, 200, 0.5)],
  },
  {
    typeId: "builtin.blur.directional",
    label: "Directional Blur",
    category: "blur",
    params: [num("length", "Length", 20, 0, 200), num("angle", "Angle", 0, 0, 360)],
  },
  {
    typeId: "builtin.blur.radial",
    label: "Radial Blur",
    category: "blur",
    params: [num("amount", "Amount", 10, 0, 100)],
  },
  {
    typeId: "builtin.sharpen",
    label: "Sharpen",
    category: "stylize",
    params: [num("amount", "Amount", 50, 0, 200)],
  },
  {
    typeId: "builtin.noise",
    label: "Noise",
    category: "stylize",
    params: [num("amount", "Amount", 20, 0, 100)],
  },
  {
    typeId: "builtin.glow",
    label: "Glow",
    category: "stylize",
    params: [num("threshold", "Threshold", 70, 0, 100), num("radius", "Radius", 20, 0, 200), num("intensity", "Intensity", 50, 0, 200)],
  },
  {
    typeId: "builtin.chromaticAberration",
    label: "Chromatic Aberration",
    category: "distort",
    params: [num("offset", "Offset", 4, 0, 50)],
  },
  {
    typeId: "builtin.mosaic",
    label: "Mosaic / Pixelate",
    category: "stylize",
    params: [num("blockSize", "Block Size", 12, 2, 128, 1)],
  },
  {
    typeId: "builtin.vignette",
    label: "Vignette",
    category: "stylize",
    params: [num("amount", "Amount", 40, 0, 100), num("softness", "Softness", 50, 0, 100)],
  },
  {
    typeId: "builtin.filmGrain",
    label: "Film Grain",
    category: "stylize",
    params: [num("amount", "Amount", 25, 0, 100)],
  },
  {
    typeId: "builtin.vhs",
    label: "VHS",
    category: "stylize",
    params: [num("bleed", "Bleed", 30, 0, 100), num("noise", "Noise", 20, 0, 100)],
  },
  {
    typeId: "builtin.mirror",
    label: "Mirror",
    category: "distort",
    params: [
      {
        key: "axis",
        label: "Axis",
        type: "enum",
        defaultValue: "horizontal",
        enumValues: ["horizontal", "vertical"],
        animatable: false,
      },
    ],
  },
  {
    typeId: "builtin.color.lgg",
    label: "Lift / Gamma / Gain",
    category: "color",
    params: [
      num("liftMaster", "Lift", 0, -1, 1, 0.01),
      num("gammaMaster", "Gamma", 0, -1, 1, 0.01),
      num("gainMaster", "Gain", 0, -1, 1, 0.01),
      num("saturation", "Saturation", 1, 0, 4, 0.01),
      num("exposure", "Exposure", 0, -4, 4, 0.01),
      num("temperature", "Temperature", 0, -1, 1, 0.01),
      num("tint", "Tint", 0, -1, 1, 0.01),
    ],
  },
  {
    typeId: "builtin.color.lut",
    label: "LUT",
    category: "color",
    params: [
      { key: "path", label: "LUT Path", type: "string", defaultValue: "", animatable: false },
      num("intensity", "Intensity", 100, 0, 100),
    ],
  },
  {
    typeId: "builtin.key.chroma",
    label: "Chroma Key",
    category: "keying",
    params: [
      { key: "color", label: "Key Color", type: "color", defaultValue: "#00ff00", animatable: false },
      num("tolerance", "Tolerance", 40, 0, 100),
      num("edgeSoftness", "Edge Softness", 10, 0, 100),
    ],
  },
  {
    typeId: "builtin.audio.eq",
    label: "Parametric EQ",
    category: "audio",
    params: [
      num("lowGain", "Low Gain", 0, -24, 24),
      num("midGain", "Mid Gain", 0, -24, 24),
      num("highGain", "High Gain", 0, -24, 24),
    ],
  },
  {
    typeId: "builtin.audio.compressor",
    label: "Compressor",
    category: "audio",
    params: [
      num("threshold", "Threshold", -18, -60, 0),
      num("ratio", "Ratio", 4, 1, 20),
      num("attack", "Attack ms", 10, 0, 200),
      num("release", "Release ms", 100, 1, 1000),
    ],
  },
  {
    typeId: "builtin.audio.reverb",
    label: "Reverb",
    category: "audio",
    params: [num("mix", "Mix", 20, 0, 100), num("decay", "Decay", 40, 0, 100)],
  },
  {
    typeId: "builtin.audio.denoise",
    label: "DeNoise",
    category: "audio",
    params: [num("amount", "Amount", 50, 0, 100)],
  },
] as const;

export function getEffectPreset(typeId: string): EffectPreset | undefined {
  return EFFECT_PRESETS.find((e) => e.typeId === typeId);
}

export function effectsByCategory(category: EffectCategory): EffectPreset[] {
  return EFFECT_PRESETS.filter((e) => e.category === category);
}

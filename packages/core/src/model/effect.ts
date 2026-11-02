import type { EffectId, KeyframeId } from "../util/id.js";
import { createId } from "../util/id.js";
import type { TimeTicks } from "../util/time.js";
import type { Keyframe } from "./keyframe.js";
import type { KeyframeInterpolation } from "./enums.js";

/** Parameter value kinds supported by the effect SDK. */
export type EffectParamValue = number | boolean | string | readonly number[];

/** Descriptor of a single effect parameter (static schema, not instance data). */
export interface EffectParamDescriptor {
  readonly key: string;
  readonly label: string;
  readonly type: "number" | "boolean" | "string" | "color" | "enum" | "vec2" | "vec3" | "vec4";
  readonly defaultValue: EffectParamValue;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly enumValues?: readonly string[];
  readonly animatable: boolean;
}

/** Runtime parameter state: either a constant or a keyframed curve. */
export type EffectParamState =
  | { readonly mode: "constant"; readonly value: EffectParamValue }
  | { readonly mode: "keyframes"; readonly keyframes: readonly Keyframe<number>[] };

/**
 * An effect / filter / color-op attached to a clip or adjustment layer.
 * Built-in effects use stable `typeId` strings (e.g. `"builtin.blur.gaussian"`).
 * Plugin effects use `"plugin.<vendor>.<name>"`.
 */
export interface EffectInstance {
  readonly id: EffectId;
  readonly typeId: string;
  readonly enabled: boolean;
  readonly params: Readonly<Record<string, EffectParamState>>;
}

/** Built-in transform effect applied to every visual clip. */
export const TRANSFORM_EFFECT_TYPE = "builtin.transform";

/** Creates a default transform effect with Premiere-like parameters. */
export function createDefaultTransform(): EffectInstance {
  return {
    id: createId<"Effect">(),
    typeId: TRANSFORM_EFFECT_TYPE,
    enabled: true,
    params: {
      positionX: { mode: "constant", value: 0 },
      positionY: { mode: "constant", value: 0 },
      scaleX: { mode: "constant", value: 100 },
      scaleY: { mode: "constant", value: 100 },
      rotation: { mode: "constant", value: 0 },
      anchorX: { mode: "constant", value: 0.5 },
      anchorY: { mode: "constant", value: 0.5 },
      opacity: { mode: "constant", value: 100 },
    },
  };
}

/**
 * Samples a numeric effect parameter at `time`. Non-numeric constants coerce via Number().
 */
export function sampleEffectParam(
  state: EffectParamState,
  time: TimeTicks,
  fallback = 0,
): number {
  if (state.mode === "constant") {
    return typeof state.value === "number" ? state.value : Number(state.value) || fallback;
  }
  if (state.keyframes.length === 0) return fallback;
  // Lazy import avoided — sample inline via sorted walk for tree-shaking friendliness.
  const sorted = [...state.keyframes].sort((a, b) =>
    a.time < b.time ? -1 : a.time > b.time ? 1 : 0,
  );
  if (time <= sorted[0]!.time) return sorted[0]!.value;
  const last = sorted[sorted.length - 1]!;
  if (time >= last.time) return last.value;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (time >= a.time && time <= b.time) {
      const span = Number(b.time - a.time);
      if (span <= 0) return b.value;
      const t = Number(time - a.time) / span;
      if (a.interpolation === "hold") return a.value;
      return a.value + (b.value - a.value) * t;
    }
  }
  return last.value;
}

/** Creates a keyframed numeric parameter from discrete samples. */
export function keyframedParam(
  samples: ReadonlyArray<{ time: TimeTicks; value: number; interpolation?: KeyframeInterpolation }>,
): EffectParamState {
  const keyframes: Keyframe<number>[] = samples.map((s) => ({
    id: createId<"Keyframe">() as KeyframeId,
    time: s.time,
    value: s.value,
    interpolation: s.interpolation ?? "linear",
  }));
  return { mode: "keyframes", keyframes };
}

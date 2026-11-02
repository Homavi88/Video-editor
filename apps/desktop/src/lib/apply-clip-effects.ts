/**
 * Applies enabled clip effects that have GPU shaders onto the current WebGL preview.
 */

import type { WebGLPreviewRenderer } from "@lumina/effects";
import { sampleEffectParam, type Clip, type EffectInstance } from "@lumina/core";

export function applyClipEffectsToRenderer(
  renderer: WebGLPreviewRenderer,
  clip: Clip,
  timeTicks: bigint,
): void {
  for (const fx of clip.effects) {
    if (!fx.enabled) continue;
    applyOne(renderer, fx, timeTicks);
  }
}

function applyOne(
  renderer: WebGLPreviewRenderer,
  fx: EffectInstance,
  time: bigint,
): void {
  switch (fx.typeId) {
    case "builtin.blur.gaussian": {
      const radius = sampleEffectParam(fx.params.radius!, time, 10);
      renderer.applyBlur(Math.max(0.1, radius / 10));
      break;
    }
    case "builtin.vignette": {
      const amount = sampleEffectParam(fx.params.amount!, time, 40) / 100;
      const softness = sampleEffectParam(fx.params.softness!, time, 50) / 100;
      renderer.applyVignette(amount, Math.max(0.05, softness));
      break;
    }
    case "builtin.color.lgg": {
      const lift = sampleEffectParam(fx.params.liftMaster!, time, 0);
      const gamma = sampleEffectParam(fx.params.gammaMaster!, time, 0);
      const gain = sampleEffectParam(fx.params.gainMaster!, time, 0);
      const sat = sampleEffectParam(fx.params.saturation!, time, 1);
      const exp = sampleEffectParam(fx.params.exposure!, time, 0);
      renderer.applyLgg(lift, gamma, gain, sat, exp);
      break;
    }
    case "builtin.filmGrain": {
      const amount = sampleEffectParam(fx.params.amount!, time, 25) / 100;
      renderer.applyFilmGrain(amount, Number(time) / 10_000_000);
      break;
    }
    case "builtin.sharpen": {
      const amount = sampleEffectParam(fx.params.amount!, time, 50) / 50;
      renderer.applySharpen(amount);
      break;
    }
    case "builtin.mosaic": {
      const block = sampleEffectParam(fx.params.blockSize!, time, 12);
      renderer.applyMosaic(Math.max(2, 128 / Math.max(1, block)));
      break;
    }
    case "builtin.mirror": {
      renderer.applyMirror(false);
      break;
    }
    case "builtin.noise": {
      const amount = sampleEffectParam(fx.params.amount!, time, 20) / 100;
      renderer.applyNoise(amount, Number(time) / 10_000_000);
      break;
    }
    case "builtin.color.lut": {
      // Intensity is applied by ProgramMonitor via activeLut; keep stack order marker.
      break;
    }
    default:
      break;
  }
}

/** Applies effects from every enabled adjustment-layer clip covering `time`. */
export function applyAdjustmentEffects(
  renderer: WebGLPreviewRenderer,
  clips: readonly Clip[],
  time: bigint,
): void {
  for (const clip of clips) {
    if (!clip.enabled) continue;
    applyClipEffectsToRenderer(renderer, clip, time);
  }
}

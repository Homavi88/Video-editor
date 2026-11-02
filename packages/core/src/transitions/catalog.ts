/**
 * Built-in transition catalog. GPU GLSL implementations live in `@lumina/effects`;
 * this module is the domain registry (ids, defaults, categories).
 */

export type TransitionCategory = "dissolve" | "wipe" | "slide" | "3d" | "stylize" | "audio";

export interface TransitionPreset {
  readonly id: string;
  readonly label: string;
  readonly category: TransitionCategory;
  /** Default duration in seconds. */
  readonly defaultSeconds: number;
  /** gl-transitions compatible shader name when applicable. */
  readonly glTransition?: string;
  readonly alignment: "start" | "center" | "end";
}

/** Video + audio transition presets shipped with Lumina. */
export const TRANSITION_PRESETS: readonly TransitionPreset[] = [
  { id: "crossDissolve", label: "Cross Dissolve", category: "dissolve", defaultSeconds: 1, glTransition: "crossfade", alignment: "center" },
  { id: "dipToBlack", label: "Dip to Black", category: "dissolve", defaultSeconds: 1, alignment: "center" },
  { id: "dipToWhite", label: "Dip to White", category: "dissolve", defaultSeconds: 1, alignment: "center" },
  { id: "filmDissolve", label: "Film Dissolve", category: "dissolve", defaultSeconds: 1.5, alignment: "center" },
  { id: "wipeLeft", label: "Wipe Left", category: "wipe", defaultSeconds: 1, glTransition: "wipeLeft", alignment: "center" },
  { id: "wipeRight", label: "Wipe Right", category: "wipe", defaultSeconds: 1, glTransition: "wipeRight", alignment: "center" },
  { id: "wipeUp", label: "Wipe Up", category: "wipe", defaultSeconds: 1, glTransition: "wipeUp", alignment: "center" },
  { id: "wipeDown", label: "Wipe Down", category: "wipe", defaultSeconds: 1, glTransition: "wipeDown", alignment: "center" },
  { id: "slideLeft", label: "Slide Left", category: "slide", defaultSeconds: 1, glTransition: "slideLeft", alignment: "center" },
  { id: "pushLeft", label: "Push Left", category: "slide", defaultSeconds: 1, alignment: "center" },
  { id: "zoom", label: "Zoom", category: "slide", defaultSeconds: 1, glTransition: "directionalwarp", alignment: "center" },
  { id: "whipPan", label: "Whip Pan", category: "stylize", defaultSeconds: 0.4, alignment: "center" },
  { id: "glitch", label: "Glitch", category: "stylize", defaultSeconds: 0.6, alignment: "center" },
  { id: "lumaFade", label: "Luma Fade", category: "dissolve", defaultSeconds: 1, alignment: "center" },
  { id: "iris", label: "Iris", category: "wipe", defaultSeconds: 1, glTransition: "circlecrop", alignment: "center" },
  { id: "pagePeel", label: "Page Peel", category: "3d", defaultSeconds: 1.2, alignment: "center" },
  { id: "cubeFlip", label: "Cube / 3D Flip", category: "3d", defaultSeconds: 1, glTransition: "cube", alignment: "center" },
  { id: "morphCut", label: "Morph Cut", category: "stylize", defaultSeconds: 1.5, alignment: "center" },
  { id: "audioConstantPower", label: "Constant Power", category: "audio", defaultSeconds: 1, alignment: "center" },
  { id: "audioConstantGain", label: "Constant Gain", category: "audio", defaultSeconds: 1, alignment: "center" },
  { id: "audioExponentialFade", label: "Exponential Fade", category: "audio", defaultSeconds: 1, alignment: "center" },
] as const;

export function getTransitionPreset(id: string): TransitionPreset | undefined {
  return TRANSITION_PRESETS.find((p) => p.id === id);
}

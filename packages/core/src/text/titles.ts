/**
 * Title / lower-third document model and animation presets.
 */

import { createId, type Id } from "../util/id.js";
import { TICKS_PER_SECOND, type TimeTicks } from "../util/time.js";

export type TitleId = Id<"Title">;

export interface TextStyle {
  readonly fontFamily: string;
  readonly fontWeight: number;
  readonly fontSize: number;
  readonly tracking: number;
  readonly lineHeight: number;
  readonly align: "left" | "center" | "right" | "justify";
  readonly fill: string;
  readonly strokeColor: string;
  readonly strokeWidth: number;
  readonly shadowColor: string;
  readonly shadowBlur: number;
  readonly shadowOffsetX: number;
  readonly shadowOffsetY: number;
  readonly background: string | null;
  readonly vertical: boolean;
  readonly rtl: boolean;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: "IBM Plex Sans",
  fontWeight: 600,
  fontSize: 72,
  tracking: 0,
  lineHeight: 1.2,
  align: "center",
  fill: "#ffffff",
  strokeColor: "#000000",
  strokeWidth: 0,
  shadowColor: "rgba(0,0,0,0.55)",
  shadowBlur: 8,
  shadowOffsetX: 0,
  shadowOffsetY: 4,
  background: null,
  vertical: false,
  rtl: false,
};

export type TitleAnimationPreset =
  | "none"
  | "typewriter"
  | "fadeIn"
  | "slideUp"
  | "bounce"
  | "karaoke";

export interface TitleDocument {
  readonly id: TitleId;
  readonly name: string;
  readonly text: string;
  readonly style: TextStyle;
  readonly animation: TitleAnimationPreset;
  readonly animationDuration: TimeTicks;
  readonly positionX: number;
  readonly positionY: number;
  /** 0..1 safe-margin aware width box. */
  readonly boxWidth: number;
}

export function createTitle(text = "Title", name = "Title"): TitleDocument {
  return {
    id: createId<"Title">(),
    name,
    text,
    style: { ...DEFAULT_TEXT_STYLE },
    animation: "fadeIn",
    animationDuration: TICKS_PER_SECOND,
    positionX: 0.5,
    positionY: 0.8,
    boxWidth: 0.8,
  };
}

export function createLowerThird(name: string, role: string): TitleDocument {
  return {
    ...createTitle(`${name}\n${role}`, "Lower Third"),
    style: {
      ...DEFAULT_TEXT_STYLE,
      fontSize: 48,
      align: "left",
      background: "rgba(10, 16, 24, 0.72)",
    },
    positionX: 0.08,
    positionY: 0.78,
    boxWidth: 0.45,
    animation: "slideUp",
  };
}

/**
 * Returns visible substring / opacity for animation presets at local clip time.
 */
export function sampleTitleAnimation(
  title: TitleDocument,
  localTime: TimeTicks,
): { text: string; opacity: number; offsetY: number } {
  const dur = title.animationDuration <= 0n ? 1n : title.animationDuration;
  const t = Math.min(1, Number(localTime) / Number(dur));
  switch (title.animation) {
    case "none":
      return { text: title.text, opacity: 1, offsetY: 0 };
    case "fadeIn":
      return { text: title.text, opacity: t, offsetY: 0 };
    case "slideUp":
      return { text: title.text, opacity: t, offsetY: (1 - t) * 40 };
    case "bounce": {
      const bounce = Math.sin(t * Math.PI);
      return { text: title.text, opacity: Math.min(1, t * 2), offsetY: (1 - bounce) * 30 };
    }
    case "typewriter": {
      const count = Math.floor(title.text.length * t);
      return { text: title.text.slice(0, count), opacity: 1, offsetY: 0 };
    }
    case "karaoke": {
      const words = title.text.split(/(\s+)/);
      const total = words.filter((w) => w.trim().length > 0).length || 1;
      const highlight = Math.floor(total * t);
      let seen = 0;
      const out = words
        .map((w) => {
          if (!w.trim()) return w;
          const active = seen === highlight;
          seen += 1;
          return active ? `«${w}»` : w;
        })
        .join("");
      return { text: out, opacity: 1, offsetY: 0 };
    }
    default: {
      const _e: never = title.animation;
      return _e;
    }
  }
}

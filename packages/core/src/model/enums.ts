/** Track kinds supported by the timeline. */
export type TrackKind = "video" | "audio" | "subtitle" | "adjustment";

/** Clip content kinds. */
export type ClipKind =
  | "video"
  | "audio"
  | "image"
  | "title"
  | "subtitle"
  | "adjustment"
  | "compound"
  | "nested-sequence";

/** Media asset kinds stored in the media pool. */
export type MediaKind = "video" | "audio" | "image" | "sequence" | "title-template";

/** Blend / compositing modes (Premiere / Resolve subset). */
export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "add"
  | "subtract"
  | "difference"
  | "hardLight"
  | "softLight"
  | "colorDodge"
  | "colorBurn"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

/** Color label tags for bins / clips / markers. */
export type ColorLabel =
  | "none"
  | "lavender"
  | "caribbean"
  | "mint"
  | "yellow"
  | "orange"
  | "peach"
  | "maroon"
  | "red"
  | "violet"
  | "blue"
  | "forest"
  | "seafoam"
  | "cerulean"
  | "magenta"
  | "tan";

/** Interpolation between keyframes. */
export type KeyframeInterpolation =
  | "hold"
  | "linear"
  | "bezier"
  | "easeIn"
  | "easeOut"
  | "easeInOut";

/** Supported color spaces for media / sequence / export. */
export type ColorSpace =
  | "srgb"
  | "rec709"
  | "rec2020"
  | "displayP3"
  | "acescg"
  | "sLog3"
  | "vLog"
  | "cLog"
  | "arriLogC";

/** Edit tool currently active on the timeline. */
export type EditTool =
  | "select"
  | "razor"
  | "ripple"
  | "roll"
  | "slip"
  | "slide"
  | "trackSelect"
  | "pen"
  | "hand"
  | "zoom";

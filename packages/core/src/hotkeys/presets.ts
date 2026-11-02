/**
 * Keyboard layout presets: Lumina / Premiere / Final Cut / Resolve.
 */

export type HotkeyAction =
  | "playPause"
  | "undo"
  | "redo"
  | "split"
  | "rippleDelete"
  | "lift"
  | "toolSelect"
  | "toolRazor"
  | "toolRipple"
  | "toolRoll"
  | "toolSlip"
  | "toolSlide"
  | "import"
  | "export"
  | "shuttleBack"
  | "shuttleStop"
  | "shuttleForward";

export type HotkeyPresetId = "lumina" | "premiere" | "finalCut" | "resolve";

export type HotkeyMap = Readonly<Record<HotkeyAction, string>>;

export const HOTKEY_PRESETS: Record<HotkeyPresetId, HotkeyMap> = {
  lumina: {
    playPause: "Space",
    undo: "Mod+Z",
    redo: "Mod+Shift+Z",
    split: "C",
    rippleDelete: "Shift+Backspace",
    lift: "Backspace",
    toolSelect: "V",
    toolRazor: "B",
    toolRipple: "B",
    toolRoll: "N",
    toolSlip: "Y",
    toolSlide: "U",
    import: "Mod+I",
    export: "Mod+M",
    shuttleBack: "J",
    shuttleStop: "K",
    shuttleForward: "L",
  },
  premiere: {
    playPause: "Space",
    undo: "Mod+Z",
    redo: "Mod+Shift+Z",
    split: "Mod+K",
    rippleDelete: "Shift+Delete",
    lift: "Delete",
    toolSelect: "V",
    toolRazor: "C",
    toolRipple: "B",
    toolRoll: "N",
    toolSlip: "Y",
    toolSlide: "U",
    import: "Mod+I",
    export: "Mod+M",
    shuttleBack: "J",
    shuttleStop: "K",
    shuttleForward: "L",
  },
  finalCut: {
    playPause: "Space",
    undo: "Mod+Z",
    redo: "Mod+Shift+Z",
    split: "Mod+B",
    rippleDelete: "Delete",
    lift: "ForwardDelete",
    toolSelect: "A",
    toolRazor: "B",
    toolRipple: "R",
    toolRoll: "T",
    toolSlip: "S",
    toolSlide: "W",
    import: "Mod+I",
    export: "Mod+E",
    shuttleBack: "J",
    shuttleStop: "K",
    shuttleForward: "L",
  },
  resolve: {
    playPause: "Space",
    undo: "Mod+Z",
    redo: "Mod+Shift+Z",
    split: "Mod+B",
    rippleDelete: "Shift+Backspace",
    lift: "Backspace",
    toolSelect: "A",
    toolRazor: "B",
    toolRipple: "T",
    toolRoll: "R",
    toolSlip: "S",
    toolSlide: "W",
    import: "Mod+I",
    export: "Mod+E",
    shuttleBack: "J",
    shuttleStop: "K",
    shuttleForward: "L",
  },
};

export function getHotkeyPreset(id: HotkeyPresetId): HotkeyMap {
  return HOTKEY_PRESETS[id];
}

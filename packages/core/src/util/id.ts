/**
 * Opaque branded string identifiers used across the Lumina domain model.
 * Branding prevents accidental mixing of clip ids with track ids at compile time.
 */

declare const brand: unique symbol;

/** Branded opaque string id. */
export type Id<T extends string> = string & { readonly [brand]: T };

export type ProjectId = Id<"Project">;
export type SequenceId = Id<"Sequence">;
export type TrackId = Id<"Track">;
export type ClipId = Id<"Clip">;
export type MediaItemId = Id<"MediaItem">;
export type EffectId = Id<"Effect">;
export type TransitionId = Id<"Transition">;
export type MarkerId = Id<"Marker">;
export type BinId = Id<"Bin">;
export type KeyframeId = Id<"Keyframe">;

/**
 * Generates a RFC4122-ish UUID v4 string branded as the given id type.
 * Uses `crypto.randomUUID` when available.
 */
export function createId<T extends string>(): Id<T> {
  const value =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : fallbackUuid();
  return value as Id<T>;
}

function fallbackUuid(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Cast an already-validated string into a branded id. */
export function asId<T extends string>(value: string): Id<T> {
  return value as Id<T>;
}

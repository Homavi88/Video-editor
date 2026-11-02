import type { BinId, MediaItemId } from "../util/id.js";
import { createId } from "../util/id.js";
import type { TimeTicks } from "../util/time.js";
import type { RationalRate } from "../util/time.js";
import type { ColorLabel, ColorSpace, MediaKind } from "./enums.js";

/** Decoded / probed technical metadata for a media file. */
export interface MediaMetadata {
  readonly duration: TimeTicks;
  readonly width?: number;
  readonly height?: number;
  readonly frameRate?: RationalRate;
  readonly videoCodec?: string;
  readonly audioCodec?: string;
  readonly audioChannels?: number;
  readonly audioSampleRate?: number;
  readonly bitRate?: number;
  readonly colorSpace?: ColorSpace;
  readonly pixelFormat?: string;
  readonly hasVideo: boolean;
  readonly hasAudio: boolean;
  /** Start timecode of the file as HH:MM:SS:FF when present. */
  readonly startTimecode?: string;
}

/** Proxy representation used for realtime editing of heavy media. */
export interface ProxyMedia {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly videoCodec: string;
}

/** A single asset in the media pool. */
export interface MediaItem {
  readonly id: MediaItemId;
  readonly kind: MediaKind;
  readonly name: string;
  /** Absolute or project-relative path to the original file. */
  readonly path: string;
  readonly metadata: MediaMetadata;
  readonly proxy?: ProxyMedia;
  readonly label: ColorLabel;
  readonly tags: readonly string[];
  readonly binId: BinId | null;
  readonly thumbnailPath?: string;
  readonly importedAt: string;
}

export interface CreateMediaItemInput {
  readonly kind: MediaKind;
  readonly name: string;
  readonly path: string;
  readonly metadata: MediaMetadata;
  readonly binId?: BinId | null;
  readonly label?: ColorLabel;
  readonly tags?: readonly string[];
  readonly thumbnailPath?: string;
}

/** Creates a media pool item with a fresh id and import timestamp. */
export function createMediaItem(input: CreateMediaItemInput): MediaItem {
  return {
    id: createId<"MediaItem">(),
    kind: input.kind,
    name: input.name,
    path: input.path,
    metadata: input.metadata,
    label: input.label ?? "none",
    tags: input.tags ?? [],
    binId: input.binId ?? null,
    ...(input.thumbnailPath !== undefined ? { thumbnailPath: input.thumbnailPath } : {}),
    importedAt: new Date().toISOString(),
  };
}

/** Hierarchical bin (folder) in the media pool. */
export interface MediaBin {
  readonly id: BinId;
  readonly name: string;
  readonly parentId: BinId | null;
  readonly label: ColorLabel;
  /** Smart-bin rule expression; empty for manual bins. */
  readonly smartRule?: string;
}

/** Creates a manual media bin. */
export function createMediaBin(name: string, parentId: BinId | null = null): MediaBin {
  return {
    id: createId<"Bin">(),
    name,
    parentId,
    label: "none",
  };
}

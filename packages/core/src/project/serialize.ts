import type { Project } from "../model/project.js";
import { PROJECT_FORMAT_VERSION } from "../model/project.js";
import { projectDocumentSchema, type ProjectDocument } from "./schema.js";
import { migrateProjectDocument } from "./migrate.js";
import { asId } from "../util/id.js";
import type {
  Clip,
  EffectInstance,
  MediaBin,
  MediaItem,
  Sequence,
  Track,
  Marker,
} from "../model/index.js";
import type { EffectParamState } from "../model/effect.js";
import type { Keyframe } from "../model/keyframe.js";
import type {
  BlendMode,
  ClipKind,
  ColorLabel,
  ColorSpace,
  MediaKind,
  TrackKind,
} from "../model/enums.js";

/**
 * Serializes a project to a JSON-safe document.
 * BigInt ticks are written as decimal strings for JSON compatibility.
 */
export function serializeProject(project: Project): unknown {
  return JSON.parse(
    JSON.stringify(project, (_key, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}

/**
 * Parses and migrates a raw JSON document into a typed {@link Project}.
 * Throws a ZodError (or migration error) when the document is invalid.
 */
export function parseProject(raw: unknown): Project {
  const migrated = migrateProjectDocument(raw);
  const doc = projectDocumentSchema.parse(migrated);
  return hydrateProject(doc);
}

/** Pretty-printed JSON string for `project.json` inside a `.lumina` package. */
export function projectToJson(project: Project): string {
  return `${JSON.stringify(serializeProject(project), null, 2)}\n`;
}

/** Loads a project from a `project.json` string. */
export function projectFromJson(json: string): Project {
  return parseProject(JSON.parse(json) as unknown);
}

function hydrateProject(doc: ProjectDocument): Project {
  return {
    id: asId(doc.id),
    formatVersion: PROJECT_FORMAT_VERSION,
    name: doc.name,
    createdAt: doc.createdAt,
    modifiedAt: doc.modifiedAt,
    media: doc.media.map(hydrateMedia),
    bins: doc.bins.map(hydrateBin),
    sequences: doc.sequences.map(hydrateSequence),
    activeSequenceId: doc.activeSequenceId ? asId(doc.activeSequenceId) : null,
    settings: doc.settings,
  };
}

function hydrateBin(bin: ProjectDocument["bins"][number]): MediaBin {
  const result: MediaBin = {
    id: asId(bin.id),
    name: bin.name,
    parentId: bin.parentId ? asId(bin.parentId) : null,
    label: bin.label as ColorLabel,
  };
  if (bin.smartRule !== undefined) {
    return { ...result, smartRule: bin.smartRule };
  }
  return result;
}

function hydrateMedia(item: ProjectDocument["media"][number]): MediaItem {
  const metadata = {
    duration: item.metadata.duration,
    hasVideo: item.metadata.hasVideo,
    hasAudio: item.metadata.hasAudio,
    ...(item.metadata.width !== undefined ? { width: item.metadata.width } : {}),
    ...(item.metadata.height !== undefined ? { height: item.metadata.height } : {}),
    ...(item.metadata.frameRate !== undefined ? { frameRate: item.metadata.frameRate } : {}),
    ...(item.metadata.videoCodec !== undefined ? { videoCodec: item.metadata.videoCodec } : {}),
    ...(item.metadata.audioCodec !== undefined ? { audioCodec: item.metadata.audioCodec } : {}),
    ...(item.metadata.audioChannels !== undefined
      ? { audioChannels: item.metadata.audioChannels }
      : {}),
    ...(item.metadata.audioSampleRate !== undefined
      ? { audioSampleRate: item.metadata.audioSampleRate }
      : {}),
    ...(item.metadata.bitRate !== undefined ? { bitRate: item.metadata.bitRate } : {}),
    ...(item.metadata.colorSpace !== undefined
      ? { colorSpace: item.metadata.colorSpace as ColorSpace }
      : {}),
    ...(item.metadata.pixelFormat !== undefined
      ? { pixelFormat: item.metadata.pixelFormat }
      : {}),
    ...(item.metadata.startTimecode !== undefined
      ? { startTimecode: item.metadata.startTimecode }
      : {}),
  };

  const result: MediaItem = {
    id: asId(item.id),
    kind: item.kind as MediaKind,
    name: item.name,
    path: item.path,
    metadata,
    label: item.label as ColorLabel,
    tags: item.tags,
    binId: item.binId ? asId(item.binId) : null,
    importedAt: item.importedAt,
  };

  if (item.proxy !== undefined) {
    return {
      ...result,
      proxy: item.proxy,
      ...(item.thumbnailPath !== undefined ? { thumbnailPath: item.thumbnailPath } : {}),
    };
  }
  if (item.thumbnailPath !== undefined) {
    return { ...result, thumbnailPath: item.thumbnailPath };
  }
  return result;
}

function hydrateSequence(seq: ProjectDocument["sequences"][number]): Sequence {
  return {
    id: asId(seq.id),
    name: seq.name,
    frameRate: seq.frameRate,
    width: seq.width,
    height: seq.height,
    sampleRate: seq.sampleRate,
    audioChannels: seq.audioChannels,
    colorSpace: seq.colorSpace as ColorSpace,
    videoTracks: seq.videoTracks.map(hydrateTrack),
    audioTracks: seq.audioTracks.map(hydrateTrack),
    subtitleTracks: seq.subtitleTracks.map(hydrateTrack),
    markers: seq.markers.map(hydrateMarker),
    inPoint: seq.inPoint,
    outPoint: seq.outPoint,
  };
}

function hydrateMarker(marker: ProjectDocument["sequences"][number]["markers"][number]): Marker {
  return {
    id: asId(marker.id),
    time: marker.time,
    duration: marker.duration,
    name: marker.name,
    comment: marker.comment,
    label: marker.label as ColorLabel,
  };
}

function hydrateTrack(track: ProjectDocument["sequences"][number]["videoTracks"][number]): Track {
  return {
    id: asId(track.id),
    kind: track.kind as TrackKind,
    name: track.name,
    locked: track.locked,
    muted: track.muted,
    solo: track.solo,
    hidden: track.hidden,
    height: track.height,
    clips: track.clips.map(hydrateClip),
  };
}

function hydrateClip(
  clip: ProjectDocument["sequences"][number]["videoTracks"][number]["clips"][number],
): Clip {
  let source: Clip["source"];
  if (clip.source.type === "media") {
    source = { type: "media", mediaId: asId(clip.source.mediaId) };
  } else if (clip.source.type === "sequence") {
    source = { type: "sequence", sequenceId: asId(clip.source.sequenceId) };
  } else {
    source = { type: "generated", generatorId: clip.source.generatorId };
  }

  const result: Clip = {
    id: asId(clip.id),
    kind: clip.kind as ClipKind,
    source,
    start: clip.start,
    duration: clip.duration,
    inPoint: clip.inPoint,
    outPoint: clip.outPoint,
    speed: clip.speed,
    enabled: clip.enabled,
    locked: clip.locked,
    name: clip.name,
    label: clip.label as ColorLabel,
    blendMode: clip.blendMode as BlendMode,
    effects: clip.effects.map(hydrateEffect),
    linkedClipIds: clip.linkedClipIds.map((id) => asId<"Clip">(id)),
  };

  if (clip.transitionInId !== undefined && clip.transitionOutId !== undefined) {
    return {
      ...result,
      transitionInId: asId(clip.transitionInId),
      transitionOutId: asId(clip.transitionOutId),
    };
  }
  if (clip.transitionInId !== undefined) {
    return { ...result, transitionInId: asId(clip.transitionInId) };
  }
  if (clip.transitionOutId !== undefined) {
    return { ...result, transitionOutId: asId(clip.transitionOutId) };
  }
  return result;
}

function hydrateEffect(
  effect: ProjectDocument["sequences"][number]["videoTracks"][number]["clips"][number]["effects"][number],
): EffectInstance {
  const params: Record<string, EffectParamState> = {};
  for (const [key, state] of Object.entries(effect.params)) {
    if (state.mode === "constant") {
      params[key] = { mode: "constant", value: state.value };
    } else {
      const keyframes: Keyframe<number>[] = state.keyframes.map((kf) => {
        const base: Keyframe<number> = {
          id: asId(kf.id),
          time: kf.time,
          value: kf.value,
          interpolation: kf.interpolation,
        };
        if (kf.outTangent !== undefined && kf.inTangent !== undefined) {
          return { ...base, outTangent: kf.outTangent, inTangent: kf.inTangent };
        }
        if (kf.outTangent !== undefined) return { ...base, outTangent: kf.outTangent };
        if (kf.inTangent !== undefined) return { ...base, inTangent: kf.inTangent };
        return base;
      });
      params[key] = { mode: "keyframes", keyframes };
    }
  }
  return {
    id: asId(effect.id),
    typeId: effect.typeId,
    enabled: effect.enabled,
    params,
  };
}

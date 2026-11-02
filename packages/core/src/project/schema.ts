import { z } from "zod";
import { PROJECT_FORMAT_VERSION } from "../model/project.js";

/** Zod schema for bigint serialized as decimal string in JSON. */
const ticksSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((v) => BigInt(v));

const rationalRateSchema = z.object({
  numerator: z.number().int().positive(),
  denominator: z.number().int().positive(),
});

const effectParamStateSchema = z.union([
  z.object({
    mode: z.literal("constant"),
    value: z.union([z.number(), z.boolean(), z.string(), z.array(z.number())]),
  }),
  z.object({
    mode: z.literal("keyframes"),
    keyframes: z.array(
      z.object({
        id: z.string().min(1),
        time: ticksSchema,
        value: z.number(),
        interpolation: z.enum(["hold", "linear", "bezier", "easeIn", "easeOut", "easeInOut"]),
        outTangent: z.object({ x: z.number(), y: z.number() }).optional(),
        inTangent: z.object({ x: z.number(), y: z.number() }).optional(),
      }),
    ),
  }),
]);

const effectSchema = z.object({
  id: z.string().min(1),
  typeId: z.string().min(1),
  enabled: z.boolean(),
  params: z.record(effectParamStateSchema),
});

const clipSourceSchema = z.union([
  z.object({ type: z.literal("media"), mediaId: z.string().min(1) }),
  z.object({ type: z.literal("sequence"), sequenceId: z.string().min(1) }),
  z.object({ type: z.literal("generated"), generatorId: z.string().min(1) }),
]);

const clipSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    "video",
    "audio",
    "image",
    "title",
    "subtitle",
    "adjustment",
    "compound",
    "nested-sequence",
  ]),
  source: clipSourceSchema,
  start: ticksSchema,
  duration: ticksSchema,
  inPoint: ticksSchema,
  outPoint: ticksSchema,
  speed: z.number(),
  enabled: z.boolean(),
  locked: z.boolean(),
  name: z.string(),
  label: z.string(),
  blendMode: z.string(),
  effects: z.array(effectSchema),
  transitionInId: z.string().optional(),
  transitionOutId: z.string().optional(),
  linkedClipIds: z.array(z.string()),
});

const trackSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["video", "audio", "subtitle", "adjustment"]),
  name: z.string(),
  locked: z.boolean(),
  muted: z.boolean(),
  solo: z.boolean(),
  hidden: z.boolean(),
  height: z.number().positive(),
  clips: z.array(clipSchema),
});

const markerSchema = z.object({
  id: z.string().min(1),
  time: ticksSchema,
  duration: ticksSchema,
  name: z.string(),
  comment: z.string(),
  label: z.string(),
});

const sequenceSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  frameRate: rationalRateSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  sampleRate: z.number().int().positive(),
  audioChannels: z.union([z.literal(1), z.literal(2), z.literal(6)]),
  colorSpace: z.string(),
  videoTracks: z.array(trackSchema),
  audioTracks: z.array(trackSchema),
  subtitleTracks: z.array(trackSchema),
  markers: z.array(markerSchema),
  inPoint: ticksSchema.nullable(),
  outPoint: ticksSchema.nullable(),
});

const mediaMetadataSchema = z.object({
  duration: ticksSchema,
  width: z.number().optional(),
  height: z.number().optional(),
  frameRate: rationalRateSchema.optional(),
  videoCodec: z.string().optional(),
  audioCodec: z.string().optional(),
  audioChannels: z.number().optional(),
  audioSampleRate: z.number().optional(),
  bitRate: z.number().optional(),
  colorSpace: z.string().optional(),
  pixelFormat: z.string().optional(),
  hasVideo: z.boolean(),
  hasAudio: z.boolean(),
  startTimecode: z.string().optional(),
});

const mediaItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["video", "audio", "image", "sequence", "title-template"]),
  name: z.string(),
  path: z.string(),
  metadata: mediaMetadataSchema,
  proxy: z
    .object({
      path: z.string(),
      width: z.number(),
      height: z.number(),
      videoCodec: z.string(),
    })
    .optional(),
  label: z.string(),
  tags: z.array(z.string()),
  binId: z.string().nullable(),
  thumbnailPath: z.string().optional(),
  importedAt: z.string(),
});

const binSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  parentId: z.string().nullable(),
  label: z.string(),
  smartRule: z.string().optional(),
});

const settingsSchema = z.object({
  autoSaveMinutes: z.number().positive(),
  proxyEnabled: z.boolean(),
  previewResolution: z.enum(["full", "half", "quarter"]),
  scratchDisk: z.string().nullable(),
});

/** On-disk project document schema (current version). */
export const projectDocumentSchema = z.object({
  id: z.string().min(1),
  formatVersion: z.number().int().positive(),
  name: z.string(),
  createdAt: z.string(),
  modifiedAt: z.string(),
  media: z.array(mediaItemSchema),
  bins: z.array(binSchema),
  sequences: z.array(sequenceSchema),
  activeSequenceId: z.string().nullable(),
  settings: settingsSchema,
});

export type ProjectDocument = z.infer<typeof projectDocumentSchema>;

export { PROJECT_FORMAT_VERSION };

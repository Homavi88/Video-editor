/**
 * Export / transcoder preset catalog.
 * Patent note: H.264/H.265 may require MPEG-LA royalties for commercial distribution.
 */

export type ExportContainer = "mp4" | "mov" | "webm" | "mkv" | "gif" | "wav" | "mp3" | "aac" | "flac" | "png-seq" | "exr-seq";

export type VideoCodec = "h264" | "h265" | "vp9" | "av1" | "prores" | "dnxhr" | "gif" | "png" | "exr" | "none";
export type AudioCodec = "aac" | "mp3" | "pcm_s16le" | "flac" | "opus" | "none";
export type RateControl = "crf" | "cbr" | "vbr";

export interface ExportPreset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly container: ExportContainer;
  readonly videoCodec: VideoCodec;
  readonly audioCodec: AudioCodec;
  readonly width: number;
  readonly height: number;
  readonly frameRate: { readonly numerator: number; readonly denominator: number };
  readonly rateControl: RateControl;
  readonly crf?: number;
  readonly videoBitrateKbps?: number;
  readonly audioBitrateKbps?: number;
  readonly pixelFormat: string;
  /** True when distribution may involve patent pools. */
  readonly patentWarning: boolean;
  readonly hardwareHints: readonly ("nvenc" | "qsv" | "amf" | "videotoolbox")[];
}

export const EXPORT_PRESETS: readonly ExportPreset[] = [
  {
    id: "youtube-4k",
    label: "YouTube 4K",
    description: "3840×2160 H.264 high profile",
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    width: 3840,
    height: 2160,
    frameRate: { numerator: 30, denominator: 1 },
    rateControl: "crf",
    crf: 18,
    audioBitrateKbps: 320,
    pixelFormat: "yuv420p",
    patentWarning: true,
    hardwareHints: ["nvenc", "qsv", "amf", "videotoolbox"],
  },
  {
    id: "instagram-reels",
    label: "Instagram Reels 9:16",
    description: "1080×1920 vertical",
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    width: 1080,
    height: 1920,
    frameRate: { numerator: 30, denominator: 1 },
    rateControl: "crf",
    crf: 20,
    audioBitrateKbps: 192,
    pixelFormat: "yuv420p",
    patentWarning: true,
    hardwareHints: ["nvenc", "videotoolbox"],
  },
  {
    id: "tiktok",
    label: "TikTok",
    description: "1080×1920 H.264",
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    width: 1080,
    height: 1920,
    frameRate: { numerator: 30, denominator: 1 },
    rateControl: "crf",
    crf: 20,
    audioBitrateKbps: 192,
    pixelFormat: "yuv420p",
    patentWarning: true,
    hardwareHints: ["nvenc", "videotoolbox"],
  },
  {
    id: "twitter",
    label: "Twitter / X",
    description: "1920×1080 H.264",
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    width: 1920,
    height: 1080,
    frameRate: { numerator: 30, denominator: 1 },
    rateControl: "crf",
    crf: 22,
    audioBitrateKbps: 160,
    pixelFormat: "yuv420p",
    patentWarning: true,
    hardwareHints: ["nvenc"],
  },
  {
    id: "vimeo-1080",
    label: "Vimeo 1080p",
    description: "High quality upload",
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    width: 1920,
    height: 1080,
    frameRate: { numerator: 25, denominator: 1 },
    rateControl: "crf",
    crf: 17,
    audioBitrateKbps: 320,
    pixelFormat: "yuv420p",
    patentWarning: true,
    hardwareHints: ["nvenc", "qsv", "amf", "videotoolbox"],
  },
  {
    id: "webm-av1",
    label: "WebM AV1",
    description: "Royalty-friendly web delivery",
    container: "webm",
    videoCodec: "av1",
    audioCodec: "opus",
    width: 1920,
    height: 1080,
    frameRate: { numerator: 30, denominator: 1 },
    rateControl: "crf",
    crf: 28,
    audioBitrateKbps: 128,
    pixelFormat: "yuv420p",
    patentWarning: false,
    hardwareHints: [],
  },
  {
    id: "prores-422",
    label: "ProRes 422",
    description: "Mezzanine MOV",
    container: "mov",
    videoCodec: "prores",
    audioCodec: "pcm_s16le",
    width: 1920,
    height: 1080,
    frameRate: { numerator: 25, denominator: 1 },
    rateControl: "cbr",
    pixelFormat: "yuv422p10le",
    patentWarning: false,
    hardwareHints: ["videotoolbox"],
  },
  {
    id: "audio-wav",
    label: "Audio WAV",
    description: "48 kHz PCM",
    container: "wav",
    videoCodec: "none",
    audioCodec: "pcm_s16le",
    width: 0,
    height: 0,
    frameRate: { numerator: 1, denominator: 1 },
    rateControl: "cbr",
    pixelFormat: "none",
    patentWarning: false,
    hardwareHints: [],
  },
] as const;

export function getExportPreset(id: string): ExportPreset | undefined {
  return EXPORT_PRESETS.find((p) => p.id === id);
}

export interface ExportJob {
  readonly id: string;
  readonly presetId: string;
  readonly sequenceId: string;
  readonly outputPath: string;
  readonly status: "queued" | "running" | "completed" | "failed" | "cancelled";
  readonly progress: number;
  readonly etaSeconds: number | null;
  readonly error: string | null;
  readonly patentAcknowledged: boolean;
}

/** Creates a queued export job. */
export function createExportJob(input: {
  presetId: string;
  sequenceId: string;
  outputPath: string;
  patentAcknowledged?: boolean;
}): ExportJob {
  const preset = getExportPreset(input.presetId);
  if (!preset) throw new Error(`unknown export preset: ${input.presetId}`);
  if (preset.patentWarning && !input.patentAcknowledged) {
    throw new Error(
      `Preset "${preset.label}" uses ${preset.videoCodec.toUpperCase()}, which may require MPEG-LA patent royalties. Pass patentAcknowledged: true to proceed.`,
    );
  }
  return {
    id: cryptoRandom(),
    presetId: input.presetId,
    sequenceId: input.sequenceId,
    outputPath: input.outputPath,
    status: "queued",
    progress: 0,
    etaSeconds: null,
    error: null,
    patentAcknowledged: Boolean(input.patentAcknowledged),
  };
}

function cryptoRandom(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Builds an ffmpeg argument list for a preset (single-file transcoder path).
 * Compositional NLE export wires filters later; this covers the Converter module.
 */
export function buildFfmpegArgs(preset: ExportPreset, inputPath: string, outputPath: string): string[] {
  const args = ["-y", "-i", inputPath];
  if (preset.videoCodec === "none") {
    args.push("-vn");
  } else {
    args.push("-c:v", mapVideoCodec(preset.videoCodec));
    if (preset.width > 0 && preset.height > 0) {
      args.push("-vf", `scale=${preset.width}:${preset.height}`);
    }
    if (preset.rateControl === "crf" && preset.crf !== undefined) {
      args.push("-crf", String(preset.crf));
    } else if (preset.videoBitrateKbps) {
      args.push("-b:v", `${preset.videoBitrateKbps}k`);
    }
    if (preset.pixelFormat !== "none") args.push("-pix_fmt", preset.pixelFormat);
  }
  if (preset.audioCodec === "none") {
    args.push("-an");
  } else {
    args.push("-c:a", mapAudioCodec(preset.audioCodec));
    if (preset.audioBitrateKbps) args.push("-b:a", `${preset.audioBitrateKbps}k`);
  }
  args.push(outputPath);
  return args;
}

/** Maps domain video codec id → ffmpeg -c:v flag. */
export function mapVideoCodec(codec: VideoCodec): string {
  switch (codec) {
    case "h264":
      return "libx264";
    case "h265":
      return "libx265";
    case "vp9":
      return "libvpx-vp9";
    case "av1":
      return "libaom-av1";
    case "prores":
      return "prores_ks";
    case "dnxhr":
      return "dnxhd";
    case "gif":
      return "gif";
    case "png":
      return "png";
    case "exr":
      return "exr";
    case "none":
      return "copy";
    default: {
      const _e: never = codec;
      return _e;
    }
  }
}

function mapAudioCodec(codec: AudioCodec): string {
  switch (codec) {
    case "aac":
      return "aac";
    case "mp3":
      return "libmp3lame";
    case "pcm_s16le":
      return "pcm_s16le";
    case "flac":
      return "flac";
    case "opus":
      return "libopus";
    case "none":
      return "copy";
    default: {
      const _e: never = codec;
      return _e;
    }
  }
}

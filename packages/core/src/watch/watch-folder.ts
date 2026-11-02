/**
 * Watch-folder rules: which extensions to pick up and how to classify them.
 */

export const WATCH_MEDIA_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".mkv",
  ".avi",
  ".webm",
  ".mxf",
  ".mp3",
  ".wav",
  ".aac",
  ".flac",
  ".m4a",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
] as const;

export function isWatchableMediaPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return WATCH_MEDIA_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function classifyMediaKind(
  filePath: string,
): "video" | "audio" | "image" {
  const lower = filePath.toLowerCase();
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(lower)) return "image";
  if (/\.(mp3|wav|flac|aac|m4a)$/i.test(lower)) return "audio";
  return "video";
}

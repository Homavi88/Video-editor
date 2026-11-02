/**
 * Subtitle / caption utilities: SRT and WebVTT parse/serialize + cue model.
 */

import { createId, type Id } from "../util/id.js";
import { secondsToTicks, ticksToSeconds, type TimeTicks } from "../util/time.js";

export type CueId = Id<"Cue">;

export interface SubtitleCue {
  readonly id: CueId;
  readonly start: TimeTicks;
  readonly end: TimeTicks;
  readonly text: string;
}

export interface SubtitleTrackDoc {
  readonly cues: readonly SubtitleCue[];
}

/** Parses SRT content into cues. */
export function parseSrt(content: string): SubtitleCue[] {
  const blocks = content.replace(/^\uFEFF/, "").trim().split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length < 2) continue;
    const timeLine = lines[0]!.includes("-->") ? lines[0]! : lines[1]!;
    const textLines = lines[0]!.includes("-->") ? lines.slice(1) : lines.slice(2);
    const times = timeLine.split("-->").map((s) => s.trim());
    if (times.length < 2) continue;
    const start = parseSrtTimestamp(times[0]!);
    const end = parseSrtTimestamp(times[1]!.split(/\s+/)[0]!);
    cues.push({
      id: createId<"Cue">(),
      start,
      end,
      text: textLines.join("\n"),
    });
  }
  return cues;
}

/** Serializes cues to SRT. */
export function serializeSrt(cues: readonly SubtitleCue[]): string {
  return cues
    .map((cue, i) => {
      return `${i + 1}\n${formatSrtTimestamp(cue.start)} --> ${formatSrtTimestamp(cue.end)}\n${cue.text}\n`;
    })
    .join("\n");
}

/** Parses a minimal WebVTT file. */
export function parseVtt(content: string): SubtitleCue[] {
  const body = content.replace(/^\uFEFF/, "").replace(/^WEBVTT[^\n]*\n/, "");
  const blocks = body.trim().split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length < 2) continue;
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;
    const idx = lines.indexOf(timeLine);
    const [startRaw, endRaw] = timeLine.split("-->").map((s) => s.trim());
    cues.push({
      id: createId<"Cue">(),
      start: parseVttTimestamp(startRaw!),
      end: parseVttTimestamp(endRaw!.split(/\s+/)[0]!),
      text: lines.slice(idx + 1).join("\n"),
    });
  }
  return cues;
}

/** Serializes cues to WebVTT. */
export function serializeVtt(cues: readonly SubtitleCue[]): string {
  const body = cues
    .map((cue) => {
      return `${formatVttTimestamp(cue.start)} --> ${formatVttTimestamp(cue.end)}\n${cue.text}\n`;
    })
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

/** Active cue texts at timeline time. */
export function cuesAtTime(cues: readonly SubtitleCue[], time: TimeTicks): string[] {
  return cues.filter((c) => time >= c.start && time < c.end).map((c) => c.text);
}

function parseSrtTimestamp(value: string): TimeTicks {
  // HH:MM:SS,mmm
  const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(value);
  if (!m) throw new Error(`invalid SRT timestamp: ${value}`);
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  const seconds = Number(m[3]);
  const ms = Number(m[4].padEnd(3, "0").slice(0, 3));
  return secondsToTicks(hours * 3600 + minutes * 60 + seconds + ms / 1000);
}

function formatSrtTimestamp(ticks: TimeTicks): string {
  const totalMs = Math.max(0, Math.round(ticksToSeconds(ticks) * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return `${pad(h, 2)}:${pad(min, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

function parseVttTimestamp(value: string): TimeTicks {
  const parts = value.split(":");
  if (parts.length === 3) {
    const [h, m, rest] = parts;
    const [sec, frac = "0"] = rest!.split(".");
    return secondsToTicks(Number(h) * 3600 + Number(m) * 60 + Number(sec) + Number(`0.${frac}`));
  }
  if (parts.length === 2) {
    const [m, rest] = parts;
    const [sec, frac = "0"] = rest!.split(".");
    return secondsToTicks(Number(m) * 60 + Number(sec) + Number(`0.${frac}`));
  }
  throw new Error(`invalid VTT timestamp: ${value}`);
}

function formatVttTimestamp(ticks: TimeTicks): string {
  const totalMs = Math.max(0, Math.round(ticksToSeconds(ticks) * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return `${pad(h, 2)}:${pad(min, 2)}:${pad(s, 2)}.${pad(ms, 3)}`;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

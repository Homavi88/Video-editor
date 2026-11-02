/**
 * Autosave / versioning helpers for `.lumina` packages.
 */

import type { Project } from "../model/project.js";
import { projectToJson } from "./serialize.js";

export interface AutosaveSnapshot {
  readonly savedAt: string;
  readonly reason: "interval" | "manual" | "crash-recovery";
  readonly json: string;
}

/** Creates an autosave snapshot document from the current project. */
export function createAutosaveSnapshot(
  project: Project,
  reason: AutosaveSnapshot["reason"] = "interval",
): AutosaveSnapshot {
  return {
    savedAt: new Date().toISOString(),
    reason,
    json: projectToJson(project),
  };
}

/**
 * Returns true when enough minutes elapsed since `lastSavedAt` given project settings.
 */
export function shouldAutosave(
  lastSavedAt: string | null,
  autoSaveMinutes: number,
  now = Date.now(),
): boolean {
  if (autoSaveMinutes <= 0) return false;
  if (!lastSavedAt) return true;
  const last = Date.parse(lastSavedAt);
  if (!Number.isFinite(last)) return true;
  return now - last >= autoSaveMinutes * 60_000;
}

/** Keeps the newest `limit` snapshots (sorted by savedAt desc). */
export function pruneSnapshots(
  snapshots: readonly AutosaveSnapshot[],
  limit = 20,
): AutosaveSnapshot[] {
  return [...snapshots]
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))
    .slice(0, Math.max(1, limit));
}

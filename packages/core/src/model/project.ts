import type { ProjectId, SequenceId } from "../util/id.js";
import { createId } from "../util/id.js";
import type { MediaBin, MediaItem } from "./media.js";
import { createMediaBin } from "./media.js";
import type { Sequence } from "./sequence.js";
import { createSequence } from "./sequence.js";

/** Current on-disk project format version. Bump when schema changes. */
export const PROJECT_FORMAT_VERSION = 1;

/**
 * Root project document. Persisted as `project.json` inside a `.lumina` package
 * plus a SQLite cache DB for thumbnails, peaks, and render cache indexes.
 */
export interface Project {
  readonly id: ProjectId;
  readonly formatVersion: number;
  readonly name: string;
  readonly createdAt: string;
  readonly modifiedAt: string;
  readonly media: readonly MediaItem[];
  readonly bins: readonly MediaBin[];
  readonly sequences: readonly Sequence[];
  readonly activeSequenceId: SequenceId | null;
  readonly settings: ProjectSettings;
}

export interface ProjectSettings {
  readonly autoSaveMinutes: number;
  readonly proxyEnabled: boolean;
  readonly previewResolution: "full" | "half" | "quarter";
  readonly scratchDisk: string | null;
}

export interface CreateProjectInput {
  readonly name?: string;
  readonly createDefaultSequence?: boolean;
}

/** Creates a new empty project with a Master bin and optional default sequence. */
export function createProject(input: CreateProjectInput = {}): Project {
  const now = new Date().toISOString();
  const masterBin = createMediaBin("Master");
  const sequences =
    input.createDefaultSequence === false ? [] : [createSequence({ name: "Sequence 01" })];
  return {
    id: createId<"Project">(),
    formatVersion: PROJECT_FORMAT_VERSION,
    name: input.name ?? "Untitled Project",
    createdAt: now,
    modifiedAt: now,
    media: [],
    bins: [masterBin],
    sequences,
    activeSequenceId: sequences[0]?.id ?? null,
    settings: {
      autoSaveMinutes: 5,
      proxyEnabled: true,
      previewResolution: "full",
      scratchDisk: null,
    },
  };
}

/** Returns the active sequence or throws when missing. */
export function requireActiveSequence(project: Project): Sequence {
  if (!project.activeSequenceId) {
    throw new Error("project has no active sequence");
  }
  const seq = project.sequences.find((s) => s.id === project.activeSequenceId);
  if (!seq) {
    throw new Error(`active sequence ${project.activeSequenceId} not found`);
  }
  return seq;
}

/** Immutable update helper that refreshes `modifiedAt`. */
export function touchProject(project: Project, patch: Partial<Project>): Project {
  return {
    ...project,
    ...patch,
    modifiedAt: new Date().toISOString(),
  };
}

/** Replaces a sequence in the project by id. */
export function updateSequence(project: Project, sequence: Sequence): Project {
  const sequences = project.sequences.map((s) => (s.id === sequence.id ? sequence : s));
  return touchProject(project, { sequences });
}

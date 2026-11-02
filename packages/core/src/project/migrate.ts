import { PROJECT_FORMAT_VERSION } from "../model/project.js";

/**
 * Migration step: transforms a document from `fromVersion` to `fromVersion + 1`.
 */
export interface Migration {
  readonly fromVersion: number;
  readonly description: string;
  migrate(doc: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Ordered migrations. Append a new entry whenever {@link PROJECT_FORMAT_VERSION} bumps.
 * Never edit an already-shipped migration body — add a new one instead.
 */
export const MIGRATIONS: readonly Migration[] = [
  // v1 is the initial format — no migrations yet.
  // Example for future bump to v2:
  // {
  //   fromVersion: 1,
  //   description: "Add sequence.backgroundColor",
  //   migrate(doc) {
  //     const sequences = (doc.sequences as Record<string, unknown>[]).map((s) => ({
  //       ...s,
  //       backgroundColor: s.backgroundColor ?? "#000000",
  //     }));
  //     return { ...doc, sequences, formatVersion: 2 };
  //   },
  // },
];

/**
 * Walks migrations until the document reaches {@link PROJECT_FORMAT_VERSION}.
 * Documents newer than the runtime are rejected.
 */
export function migrateProjectDocument(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("project document must be a JSON object");
  }
  let doc = { ...(raw as Record<string, unknown>) };
  const version = Number(doc.formatVersion);
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`invalid formatVersion: ${String(doc.formatVersion)}`);
  }
  if (version > PROJECT_FORMAT_VERSION) {
    throw new Error(
      `project format v${version} is newer than this Lumina build (supports v${PROJECT_FORMAT_VERSION})`,
    );
  }
  let current = version;
  while (current < PROJECT_FORMAT_VERSION) {
    const step = MIGRATIONS.find((m) => m.fromVersion === current);
    if (!step) {
      throw new Error(`missing migration from v${current} to v${current + 1}`);
    }
    doc = step.migrate(doc);
    current = Number(doc.formatVersion);
    if (current !== step.fromVersion + 1) {
      throw new Error(
        `migration from v${step.fromVersion} must set formatVersion to ${step.fromVersion + 1}`,
      );
    }
  }
  return doc;
}

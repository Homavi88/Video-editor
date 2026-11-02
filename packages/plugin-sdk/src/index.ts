/**
 * Lumina Plugin SDK — contracts for effect / transition / generator plugins.
 * Plugins are discovered from plugins/<id>/lumina.plugin.json at runtime (Stage 10).
 */

import type { EffectParamDescriptor } from "@lumina/core";

export interface LuminaPluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly vendor: string;
  readonly apiVersion: 1;
  readonly contributes: {
    readonly effects?: readonly PluginEffectContribution[];
    readonly transitions?: readonly PluginTransitionContribution[];
    readonly generators?: readonly PluginGeneratorContribution[];
  };
}

export interface PluginEffectContribution {
  readonly typeId: string;
  readonly label: string;
  readonly category: string;
  readonly params: readonly EffectParamDescriptor[];
  /** Path to GLSL ES 3 fragment shader relative to the plugin root. */
  readonly fragmentShader: string;
}

export interface PluginTransitionContribution {
  readonly id: string;
  readonly label: string;
  readonly fragmentShader: string;
  readonly defaultSeconds: number;
}

export interface PluginGeneratorContribution {
  readonly id: string;
  readonly label: string;
  readonly params: readonly EffectParamDescriptor[];
}

export interface PluginContext {
  readonly hostVersion: string;
  readonly log: (level: "info" | "warn" | "error", message: string) => void;
}

export interface LuminaPluginModule {
  readonly activate: (ctx: PluginContext) => void | Promise<void>;
  readonly deactivate?: () => void | Promise<void>;
}

/** Validates a manifest object; throws on structural errors. */
export function validateManifest(raw: unknown): LuminaPluginManifest {
  if (!raw || typeof raw !== "object") throw new Error("manifest must be an object");
  const m = raw as Record<string, unknown>;
  for (const key of ["id", "name", "version", "vendor"] as const) {
    if (typeof m[key] !== "string" || !(m[key] as string).length) {
      throw new Error(`manifest.${key} must be a non-empty string`);
    }
  }
  if (m.apiVersion !== 1) throw new Error("only apiVersion 1 is supported");
  if (!m.contributes || typeof m.contributes !== "object") {
    throw new Error("manifest.contributes is required");
  }
  return raw as LuminaPluginManifest;
}

/** In-memory plugin registry used by the host. */
export class PluginRegistry {
  private readonly manifests = new Map<string, LuminaPluginManifest>();

  register(manifest: LuminaPluginManifest): void {
    validateManifest(manifest);
    if (this.manifests.has(manifest.id)) {
      throw new Error(`plugin already registered: ${manifest.id}`);
    }
    this.manifests.set(manifest.id, manifest);
  }

  unregister(id: string): boolean {
    return this.manifests.delete(id);
  }

  list(): LuminaPluginManifest[] {
    return [...this.manifests.values()];
  }

  get(id: string): LuminaPluginManifest | undefined {
    return this.manifests.get(id);
  }

  allEffectTypeIds(): string[] {
    const ids: string[] = [];
    for (const m of this.manifests.values()) {
      for (const e of m.contributes.effects ?? []) ids.push(e.typeId);
    }
    return ids;
  }
}

import { describe, expect, it } from "vitest";
import { PluginRegistry, validateManifest } from "./index.js";

describe("plugin sdk", () => {
  it("registers a valid manifest", () => {
    const manifest = validateManifest({
      id: "com.example.glow",
      name: "Extra Glow",
      version: "1.0.0",
      vendor: "Example",
      apiVersion: 1,
      contributes: {
        effects: [
          {
            typeId: "plugin.example.glow",
            label: "Extra Glow",
            category: "stylize",
            params: [],
            fragmentShader: "glow.frag",
          },
        ],
      },
    });
    const registry = new PluginRegistry();
    registry.register(manifest);
    expect(registry.allEffectTypeIds()).toContain("plugin.example.glow");
  });
});

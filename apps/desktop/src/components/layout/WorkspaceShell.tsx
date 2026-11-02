import { useEffect } from "react";
import { useEditorStore } from "../../store/editor-store";
import { MediaPool } from "../media/MediaPool";
import { SourceMonitor } from "../monitors/SourceMonitor";
import { ProgramMonitor } from "../monitors/ProgramMonitor";
import { Timeline } from "../timeline/Timeline";
import { Inspector } from "../inspector/Inspector";
import { EffectsPanel } from "../effects/EffectsPanel";
import { MixerPanel } from "../mixer/MixerPanel";
import { ExportPanel } from "../export/ExportPanel";
import { ColorPanel } from "../effects/ColorPanel";
import { TitlesPanel } from "../titles/TitlesPanel";

const LAYOUT_KEY = "lumina.layout.prefs";

export function WorkspaceShell() {
  const workspace = useEditorStore((s) => s.workspace);
  const layoutPrefs = useEditorStore((s) => s.layoutPrefs);
  const setLayoutPrefs = useEditorStore((s) => s.setLayoutPrefs);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { poolWidth?: number; inspectorWidth?: number };
      setLayoutPrefs(parsed);
    } catch {
      // ignore
    }
  }, [setLayoutPrefs]);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layoutPrefs));
    } catch {
      // ignore
    }
  }, [layoutPrefs]);

  if (workspace === "export") {
    return (
      <main className="flex-1 min-h-0 p-2">
        <ExportPanel />
      </main>
    );
  }

  if (workspace === "audio") {
    return (
      <main className="flex-1 min-h-0 grid grid-rows-[1fr_280px] gap-2 p-2">
        <div className="grid grid-cols-[280px_1fr] gap-2 min-h-0">
          <MediaPool />
          <MixerPanel />
        </div>
        <Timeline />
      </main>
    );
  }

  if (workspace === "color") {
    return (
      <main className="flex-1 min-h-0 grid grid-cols-[1fr_320px] gap-2 p-2">
        <div className="grid grid-rows-[1fr_260px] gap-2 min-h-0">
          <ProgramMonitor />
          <Timeline />
        </div>
        <ColorPanel />
      </main>
    );
  }

  if (workspace === "effects") {
    return (
      <main className="flex-1 min-h-0 grid grid-cols-[260px_1fr_300px] gap-2 p-2">
        <EffectsPanel />
        <div className="grid grid-rows-[1fr_260px] gap-2 min-h-0">
          <ProgramMonitor />
          <Timeline />
        </div>
        <TitlesPanel />
      </main>
    );
  }

  const pool = layoutPrefs.poolWidth;
  const insp = layoutPrefs.inspectorWidth;

  // Edit workspace — classic NLE with persisted column widths
  return (
    <main className="flex-1 min-h-0 grid grid-rows-[minmax(220px,38%)_1fr] gap-2 p-2">
      <div
        className="grid gap-2 min-h-0"
        style={{
          gridTemplateColumns: `${pool}px minmax(0,1fr) minmax(0,1fr) ${insp}px`,
        }}
      >
        <div className="relative min-h-0 flex flex-col">
          <MediaPool />
          <input
            aria-label="Pool width"
            type="range"
            min={200}
            max={420}
            value={pool}
            className="absolute bottom-1 right-1 w-16 opacity-60"
            onChange={(e) => setLayoutPrefs({ poolWidth: Number(e.target.value) })}
          />
        </div>
        <SourceMonitor />
        <ProgramMonitor />
        <div className="relative min-h-0 flex flex-col">
          <Inspector />
          <input
            aria-label="Inspector width"
            type="range"
            min={220}
            max={420}
            value={insp}
            className="absolute bottom-1 left-1 w-16 opacity-60"
            onChange={(e) => setLayoutPrefs({ inspectorWidth: Number(e.target.value) })}
          />
        </div>
      </div>
      <Timeline />
    </main>
  );
}

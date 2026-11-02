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

export function WorkspaceShell() {
  const workspace = useEditorStore((s) => s.workspace);

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

  // Edit workspace — classic NLE
  return (
    <main className="flex-1 min-h-0 grid grid-rows-[minmax(220px,38%)_1fr] gap-2 p-2">
      <div className="grid grid-cols-[260px_1fr_1fr_280px] gap-2 min-h-0">
        <MediaPool />
        <SourceMonitor />
        <ProgramMonitor />
        <Inspector />
      </div>
      <Timeline />
    </main>
  );
}

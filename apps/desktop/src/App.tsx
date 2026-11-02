import { useEffect } from "react";
import { TopBar } from "./components/layout/TopBar";
import { WorkspaceShell } from "./components/layout/WorkspaceShell";
import { StatusBar } from "./components/layout/StatusBar";
import { useEditorStore } from "./store/editor-store";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePlaybackLoop } from "./hooks/usePlaybackLoop";

export function App() {
  const theme = useEditorStore((s) => s.theme);
  const loadRealDemoMedia = useEditorStore((s) => s.loadRealDemoMedia);
  const project = useEditorStore((s) => s.project);
  const maybeAutosave = useEditorStore((s) => s.maybeAutosave);

  useKeyboardShortcuts();
  usePlaybackLoop();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (project.media.length === 0) void loadRealDemoMedia();
  }, [loadRealDemoMedia, project.media.length]);

  useEffect(() => {
    const id = window.setInterval(() => maybeAutosave(), 30_000);
    return () => window.clearInterval(id);
  }, [maybeAutosave]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <TopBar />
      <WorkspaceShell />
      <StatusBar />
    </div>
  );
}

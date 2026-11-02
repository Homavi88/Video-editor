import { useEffect } from "react";
import { TopBar } from "./components/layout/TopBar";
import { WorkspaceShell } from "./components/layout/WorkspaceShell";
import { StatusBar } from "./components/layout/StatusBar";
import { useEditorStore } from "./store/editor-store";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePlaybackLoop } from "./hooks/usePlaybackLoop";

export function App() {
  const theme = useEditorStore((s) => s.theme);
  const addDemoMedia = useEditorStore((s) => s.addDemoMedia);
  const project = useEditorStore((s) => s.project);

  useKeyboardShortcuts();
  usePlaybackLoop();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (project.media.length === 0) addDemoMedia();
  }, [addDemoMedia, project.media.length]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <TopBar />
      <WorkspaceShell />
      <StatusBar />
    </div>
  );
}

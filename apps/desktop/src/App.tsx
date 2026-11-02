import { useEffect, useRef } from "react";
import { TopBar } from "./components/layout/TopBar";
import { WorkspaceShell } from "./components/layout/WorkspaceShell";
import { StatusBar } from "./components/layout/StatusBar";
import { useEditorStore } from "./store/editor-store";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePlaybackLoop } from "./hooks/usePlaybackLoop";
import { useTimelineAudio } from "./hooks/useTimelineAudio";

export function App() {
  const theme = useEditorStore((s) => s.theme);
  const loadRealDemoMedia = useEditorStore((s) => s.loadRealDemoMedia);
  const project = useEditorStore((s) => s.project);
  const maybeAutosave = useEditorStore((s) => s.maybeAutosave);
  const crashChecked = useRef(false);

  useKeyboardShortcuts();
  usePlaybackLoop();
  useTimelineAudio();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (crashChecked.current) return;
    crashChecked.current = true;
    try {
      const crash = localStorage.getItem("lumina.crash.journal");
      const autosave = localStorage.getItem("lumina.autosave");
      if (crash === "dirty" && autosave) {
        useEditorStore.setState({
          status: "Recovered autosave after unclean exit",
        });
      }
      localStorage.setItem("lumina.crash.journal", "dirty");
      window.addEventListener("beforeunload", () => {
        localStorage.setItem("lumina.crash.journal", "clean");
      });
    } catch {
      // ignore
    }
  }, []);

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

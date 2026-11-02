import { useEffect } from "react";
import { useEditorStore } from "../store/editor-store";
import { secondsToTicks } from "@lumina/core";

/** Premiere-like shortcuts subset. */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const store = useEditorStore.getState();
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
        return;
      }
      if (meta && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        store.redo();
        return;
      }
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        store.setPlaying(!store.playing);
        return;
      }
      if (e.key === "c" || e.key === "C") {
        store.splitAtPlayhead();
        return;
      }
      if (e.key === "v" || e.key === "V") {
        store.setTool("select");
        return;
      }
      if (e.key === "b" || e.key === "B") {
        store.setTool("razor");
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (e.shiftKey) store.extractSelected();
        else store.liftSelected();
        return;
      }
      if (e.key === "j" || e.key === "J") {
        store.setPlayhead(store.playheadTicks - secondsToTicks(1));
        return;
      }
      if (e.key === "l" || e.key === "L") {
        store.setPlayhead(store.playheadTicks + secondsToTicks(1));
        return;
      }
      if (e.key === "k" || e.key === "K") {
        store.setPlaying(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

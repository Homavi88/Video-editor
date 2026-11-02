import { t } from "@lumina/i18n";
import { useEditorStore, type WorkspaceId } from "../../store/editor-store";

const WORKSPACES: WorkspaceId[] = ["edit", "color", "audio", "effects", "export"];

export function TopBar() {
  const locale = useEditorStore((s) => s.locale);
  const theme = useEditorStore((s) => s.theme);
  const workspace = useEditorStore((s) => s.workspace);
  const project = useEditorStore((s) => s.project);
  const setWorkspace = useEditorStore((s) => s.setWorkspace);
  const setLocale = useEditorStore((s) => s.setLocale);
  const setTheme = useEditorStore((s) => s.setTheme);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const playing = useEditorStore((s) => s.playing);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const revision = useEditorStore((s) => s.revision);
  const history = useEditorStore((s) => s.history);
  const canUndo = history.canUndo;
  const canRedo = history.canRedo;
  void revision;

  return (
    <header className="flex items-center gap-3 px-3 py-2 border-b border-line bg-panel/90 backdrop-blur-sm">
      <div className="font-display text-xl tracking-tight text-accent2 min-w-[7rem]">
        {t(locale, "app.name")}
      </div>
      <div className="text-sm text-muted truncate max-w-[14rem]" title={project.name}>
        {project.name}
      </div>
      <nav className="flex items-center gap-1 ml-2">
        {WORKSPACES.map((id) => (
          <button
            key={id}
            type="button"
            className={`lum-btn ${workspace === id ? "border-accent text-accent" : ""}`}
            onClick={() => setWorkspace(id)}
          >
            {t(locale, `workspace.${id}`)}
          </button>
        ))}
      </nav>
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <button type="button" className="lum-btn" disabled={!canUndo} onClick={undo}>
          {t(locale, "action.undo")}
        </button>
        <button type="button" className="lum-btn" disabled={!canRedo} onClick={redo}>
          {t(locale, "action.redo")}
        </button>
        <button type="button" className="lum-btn-primary" onClick={() => setPlaying(!playing)}>
          {playing ? "Pause" : t(locale, "action.play")}
        </button>
        <button
          type="button"
          className="lum-btn"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {t(locale, theme === "dark" ? "theme.light" : "theme.dark")}
        </button>
        <button
          type="button"
          className="lum-btn"
          onClick={() => setLocale(locale === "ru" ? "en" : "ru")}
        >
          {locale.toUpperCase()}
        </button>
      </div>
    </header>
  );
}

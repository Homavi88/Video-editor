import { t } from "@lumina/i18n";
import { formatTimecode, useEditorStore } from "../../store/editor-store";
import { requireActiveSequence } from "@lumina/core";

export function StatusBar() {
  const locale = useEditorStore((s) => s.locale);
  const status = useEditorStore((s) => s.status);
  const playheadTicks = useEditorStore((s) => s.playheadTicks);
  const tool = useEditorStore((s) => s.tool);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const project = useEditorStore((s) => s.project);
  const sequence = requireActiveSequence(project);
  const fps = sequence.frameRate.numerator / sequence.frameRate.denominator;

  return (
    <footer className="flex items-center gap-4 px-3 py-1.5 border-t border-line bg-panel text-xs text-muted font-mono">
      <span>{t(locale, "status.ready")}</span>
      <span className="text-ink">{status}</span>
      <span className="flex-1" />
      <span>Tool: {tool}</span>
      <span>Snap: {snapEnabled ? "on" : "off"}</span>
      <span>
        {sequence.width}×{sequence.height} @{fps.toFixed(2)}
      </span>
      <span className="text-accent2">{formatTimecode(playheadTicks, Math.round(fps))}</span>
    </footer>
  );
}

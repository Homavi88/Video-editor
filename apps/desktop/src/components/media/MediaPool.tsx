import { t } from "@lumina/i18n";
import { createMediaItem, secondsToTicks, FRAME_RATES } from "@lumina/core";
import { useEditorStore } from "../../store/editor-store";

declare global {
  interface Window {
    lumina?: {
      openMediaDialog: () => Promise<string[]>;
      runFfmpeg: (args: string[]) => Promise<{ code: number; stderr: string }>;
      platform: string;
    };
  }
}

export function MediaPool() {
  const locale = useEditorStore((s) => s.locale);
  const project = useEditorStore((s) => s.project);
  const selectedMediaId = useEditorStore((s) => s.selectedMediaId);
  const selectMedia = useEditorStore((s) => s.selectMedia);
  const importMediaItems = useEditorStore((s) => s.importMediaItems);
  const addDemoMedia = useEditorStore((s) => s.addDemoMedia);
  const placeSelectedMediaAtPlayhead = useEditorStore((s) => s.placeSelectedMediaAtPlayhead);
  const dropMediaOnTimeline = useEditorStore((s) => s.dropMediaOnTimeline);
  const playheadTicks = useEditorStore((s) => s.playheadTicks);

  const onImport = async () => {
    if (window.lumina?.openMediaDialog) {
      const paths = await window.lumina.openMediaDialog();
      if (!paths.length) return;
      const items = paths.map((p) => {
        const name = p.split(/[\\/]/).pop() || p;
        const isAudio = /\.(mp3|wav|flac|aac|m4a)$/i.test(name);
        const isImage = /\.(png|jpe?g|webp|gif|svg)$/i.test(name);
        return createMediaItem({
          kind: isAudio ? "audio" : isImage ? "image" : "video",
          name,
          path: p,
          metadata: {
            duration: secondsToTicks(isImage ? 5 : 10),
            hasVideo: !isAudio,
            hasAudio: !isImage,
            ...(isAudio
              ? { audioChannels: 2, audioSampleRate: 48000 }
              : { width: 1920, height: 1080, frameRate: FRAME_RATES.fps25 }),
          },
        });
      });
      importMediaItems(items);
      return;
    }
    // Browser fallback: synthetic import
    addDemoMedia();
  };

  return (
    <section className="lum-panel flex flex-col min-h-0">
      <header className="flex items-center justify-between gap-1 px-2 py-1.5 border-b border-line text-sm">
        <span className="font-medium">{t(locale, "panel.media")}</span>
        <div className="flex gap-1">
          <button
            type="button"
            className="lum-btn"
            disabled={!selectedMediaId}
            onClick={() => placeSelectedMediaAtPlayhead()}
            title="Insert at playhead (double-click also works)"
          >
            Insert
          </button>
          <button type="button" className="lum-btn-primary" onClick={() => void onImport()}>
            {t(locale, "action.import")}
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-auto lum-scroll p-2 space-y-1">
        {project.bins.map((bin) => (
          <div key={bin.id} className="text-[11px] uppercase tracking-wide text-muted px-1">
            {bin.name}
          </div>
        ))}
        {project.media.map((item) => (
          <button
            key={item.id}
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-lumina-media", item.id);
              e.dataTransfer.setData("text/plain", item.id);
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => selectMedia(item.id)}
            onDoubleClick={() => {
              selectMedia(item.id);
              const sequence = project.sequences.find((s) => s.id === project.activeSequenceId)
                ?? project.sequences[0];
              if (!sequence) return;
              const trackId =
                item.kind === "audio"
                  ? sequence.audioTracks[0]!.id
                  : sequence.videoTracks[sequence.videoTracks.length - 1]!.id;
              dropMediaOnTimeline(item.id, trackId, playheadTicks);
            }}
            className={`w-full text-left px-2 py-1.5 border border-transparent hover:border-line ${
              selectedMediaId === item.id ? "bg-accent/15 border-accent/40" : ""
            }`}
          >
            <div className="text-sm truncate">{item.name}</div>
            <div className="text-[11px] text-muted font-mono">
              {item.kind}
              {item.metadata.width ? ` · ${item.metadata.width}×${item.metadata.height}` : ""}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

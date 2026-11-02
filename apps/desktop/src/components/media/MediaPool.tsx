import { useMemo, useState } from "react";
import { t } from "@lumina/i18n";
import { createMediaItem, secondsToTicks, FRAME_RATES, ticksToSeconds } from "@lumina/core";
import { useEditorStore } from "../../store/editor-store";
import { probePath, requestProxy, isFileBacked } from "../../lib/media-api";

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
  const attachProxyToMedia = useEditorStore((s) => s.attachProxyToMedia);
  const updateMediaTags = useEditorStore((s) => s.updateMediaTags);
  const nestSelectedAsSequence = useEditorStore((s) => s.nestSelectedAsSequence);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "video" | "audio" | "image">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return project.media.filter((item) => {
      if (kindFilter !== "all" && item.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q)) ||
        item.path.toLowerCase().includes(q)
      );
    });
  }, [project.media, query, kindFilter]);

  const onImport = async () => {
    if (window.lumina?.openMediaDialog) {
      const paths = await window.lumina.openMediaDialog();
      if (!paths.length) return;
      const items = [];
      for (const p of paths) {
        const name = p.split(/[\\/]/).pop() || p;
        const isAudio = /\.(mp3|wav|flac|aac|m4a)$/i.test(name);
        const isImage = /\.(png|jpe?g|webp|gif|svg)$/i.test(name);
        const probed = await probePath(p);
        const durationStr = probed?.metadata.duration;
        const duration =
          typeof durationStr === "string" || typeof durationStr === "number"
            ? BigInt(durationStr)
            : secondsToTicks(isImage ? 5 : 10);
        const width = Number(probed?.metadata.width) || 1920;
        const height = Number(probed?.metadata.height) || 1080;
        const item = createMediaItem({
          kind: isAudio ? "audio" : isImage ? "image" : "video",
          name,
          path: p,
          metadata: {
            duration,
            hasVideo: !isAudio,
            hasAudio: !isImage,
            ...(isAudio
              ? { audioChannels: 2, audioSampleRate: 48000 }
              : { width, height, frameRate: FRAME_RATES.fps25 }),
          },
        });
        items.push(item);
        // Auto-proxy for 4K+ material.
        if (!isAudio && !isImage && width >= 3840 && isFileBacked(p)) {
          void requestProxy(p).then((proxy) => {
            if (proxy) attachProxyToMedia(item.id, proxy);
          });
        }
      }
      importMediaItems(items);
      return;
    }
    addDemoMedia();
  };

  return (
    <section className="lum-panel flex flex-col min-h-0">
      <header className="flex items-center justify-between gap-1 px-2 py-1.5 border-b border-line text-sm">
        <span className="font-medium">{t(locale, "panel.media")}</span>
        <div className="flex gap-1">
          <button type="button" className="lum-btn" onClick={() => nestSelectedAsSequence()}>
            Nest
          </button>
          <button
            type="button"
            className="lum-btn"
            disabled={!selectedMediaId}
            onClick={() => placeSelectedMediaAtPlayhead()}
          >
            Insert
          </button>
          <button type="button" className="lum-btn-primary" onClick={() => void onImport()}>
            {t(locale, "action.import")}
          </button>
        </div>
      </header>
      <div className="px-2 py-1 border-b border-line flex gap-1">
        <input
          className="flex-1 bg-transparent border border-line px-1.5 py-0.5 text-xs"
          placeholder="Search name/tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="bg-transparent border border-line text-xs px-1"
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
        >
          <option value="all">All</option>
          <option value="video">Video</option>
          <option value="audio">Audio</option>
          <option value="image">Image</option>
        </select>
      </div>
      <div className="flex-1 overflow-auto lum-scroll p-2 space-y-1">
        {project.bins.map((bin) => (
          <div key={bin.id} className="text-[11px] uppercase tracking-wide text-muted px-1">
            {bin.name}
            {bin.smartRule ? ` · smart:${bin.smartRule}` : ""}
          </div>
        ))}
        {filtered.map((item) => (
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
              const sequence =
                project.sequences.find((s) => s.id === project.activeSequenceId) ??
                project.sequences[0];
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
              {` · ${ticksToSeconds(item.metadata.duration).toFixed(1)}s`}
              {item.proxy ? " · proxy" : ""}
            </div>
            {selectedMediaId === item.id ? (
              <div
                className="mt-1"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <input
                  className="w-full bg-transparent border border-line px-1 py-0.5 text-[10px]"
                  placeholder="tags, comma-separated"
                  defaultValue={item.tags.join(", ")}
                  onBlur={(e) =>
                    updateMediaTags(
                      item.id,
                      e.target.value
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

import { create } from "zustand";
import {
  HistoryStack,
  ImportMediaCommand,
  LiftClipCommand,
  PlaceClipCommand,
  SplitClipCommand,
  MoveClipCommand,
  TrimClipCommand,
  ExtractClipCommand,
  SetTrackFlagsCommand,
  AddMarkerCommand,
  SetClipSpeedCommand,
  createProject,
  createClip,
  createMediaItem,
  createExportJob,
  requireActiveSequence,
  secondsToTicks,
  ticksToSeconds,
  snapTime,
  collectSnapTargets,
  FRAME_RATES,
  createAutosaveSnapshot,
  shouldAutosave,
  getHotkeyPreset,
  exportEdl,
  exportFcpxml,
  exportOtioJson,
  type Project,
  type MediaItem,
  type EditTool,
  type ExportJob,
  type ClipId,
  type HotkeyPresetId,
  type MediaKind,
} from "@lumina/core";
import type { Locale } from "@lumina/i18n";
import { ensureDemoMedia, exportSequenceApi, probePath } from "../lib/media-api";

export type WorkspaceId = "edit" | "color" | "audio" | "effects" | "export";
export type ThemeMode = "dark" | "light";

export interface EditorState {
  history: HistoryStack;
  project: Project;
  revision: number;
  locale: Locale;
  theme: ThemeMode;
  workspace: WorkspaceId;
  tool: EditTool;
  playheadTicks: bigint;
  playing: boolean;
  snapEnabled: boolean;
  zoom: number;
  selectedClipId: ClipId | null;
  selectedMediaId: string | null;
  exportQueue: ExportJob[];
  status: string;
  hotkeyPreset: HotkeyPresetId;
  lastAutosaveAt: string | null;
  interchangePreview: string | null;
  // actions
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemeMode) => void;
  setWorkspace: (workspace: WorkspaceId) => void;
  setTool: (tool: EditTool) => void;
  setPlayhead: (ticks: bigint) => void;
  setPlaying: (playing: boolean) => void;
  setZoom: (zoom: number) => void;
  setSnapEnabled: (enabled: boolean) => void;
  selectClip: (id: ClipId | null) => void;
  selectMedia: (id: string | null) => void;
  setHotkeyPreset: (id: HotkeyPresetId) => void;
  undo: () => void;
  redo: () => void;
  importMediaItems: (items: MediaItem[]) => void;
  addDemoMedia: () => void;
  loadRealDemoMedia: () => Promise<void>;
  dropMediaOnTimeline: (mediaId: string, trackId: string, startTicks: bigint) => void;
  splitAtPlayhead: () => void;
  liftSelected: () => void;
  extractSelected: () => void;
  moveSelected: (newStart: bigint) => void;
  trimSelected: (patch: { start?: bigint; duration?: bigint; inPoint?: bigint; outPoint?: bigint }) => void;
  toggleTrackMute: (trackId: string) => void;
  addMarkerAtPlayhead: () => void;
  setSelectedSpeed: (speed: number) => void;
  queueExport: (presetId: string, outputPath: string, patentAcknowledged: boolean) => void;
  runSequenceExport: (outputPath: string, dryRun?: boolean) => Promise<void>;
  exportInterchange: (kind: "edl" | "fcpxml" | "otio") => void;
  maybeAutosave: () => void;
  tickPlayback: (dtSeconds: number) => void;
}

function sync(history: HistoryStack): Project {
  return history.current;
}

function bump(project: Project, revision: number, status?: string) {
  return status !== undefined
    ? { project, revision: revision + 1, status }
    : { project, revision: revision + 1 };
}

export const useEditorStore = create<EditorState>((set, get) => {
  const history = new HistoryStack(createProject({ name: "Untitled Lumina Project" }));
  return {
    history,
    project: history.current,
    revision: 0,
    locale: "ru",
    theme: "dark",
    workspace: "edit",
    tool: "select",
    playheadTicks: 0n,
    playing: false,
    snapEnabled: true,
    zoom: 80,
    selectedClipId: null,
    selectedMediaId: null,
    exportQueue: [],
    status: "Ready",
    hotkeyPreset: "lumina",
    lastAutosaveAt: null,
    interchangePreview: null,

    setLocale: (locale) => set({ locale }),
    setTheme: (theme) => {
      document.documentElement.setAttribute("data-theme", theme);
      set({ theme });
    },
    setWorkspace: (workspace) => set({ workspace }),
    setTool: (tool) => set({ tool }),
    setPlayhead: (ticks) => set({ playheadTicks: ticks < 0n ? 0n : ticks }),
    setPlaying: (playing) => set({ playing }),
    setZoom: (zoom) => set({ zoom: Math.min(400, Math.max(20, zoom)) }),
    setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
    selectClip: (selectedClipId) => set({ selectedClipId }),
    selectMedia: (selectedMediaId) => set({ selectedMediaId }),
    setHotkeyPreset: (hotkeyPreset) => {
      void getHotkeyPreset(hotkeyPreset);
      set({ hotkeyPreset, status: `Hotkeys: ${hotkeyPreset}` });
    },

    undo: () => {
      const { history, revision } = get();
      history.undo();
      set(bump(sync(history), revision, `Undo: ${history.redoLabel ?? ""}`));
    },
    redo: () => {
      const { history, revision } = get();
      history.redo();
      set(bump(sync(history), revision, `Redo: ${history.undoLabel ?? ""}`));
    },

    importMediaItems: (items) => {
      const { history, revision } = get();
      history.push(new ImportMediaCommand(items));
      set(bump(sync(history), revision, `Imported ${items.length}`));
    },

    addDemoMedia: () => {
      void get().loadRealDemoMedia();
    },

    loadRealDemoMedia: async () => {
      const demo = await ensureDemoMedia();
      if (!demo) {
        // Offline fallback placeholders
        const items: MediaItem[] = [
          createMediaItem({
            kind: "video",
            name: "Demo Bars.mp4",
            path: "demo://color-bars",
            metadata: {
              duration: secondsToTicks(8),
              width: 1280,
              height: 720,
              frameRate: FRAME_RATES.fps25,
              hasVideo: true,
              hasAudio: true,
            },
          }),
        ];
        get().importMediaItems(items);
        set({ selectedMediaId: items[0]!.id, status: "Demo placeholders (API offline)" });
        return;
      }

      const entries: Array<{ path: string; name: string; fallbackKind: MediaKind }> = [
        { path: demo.video, name: "Demo Bars.mp4", fallbackKind: "video" },
        { path: demo.audio, name: "Demo Tone.wav", fallbackKind: "audio" },
        { path: demo.image, name: "Still Gradient.png", fallbackKind: "image" },
      ];
      const items: MediaItem[] = [];
      for (const entry of entries) {
        const probed = await probePath(entry.path);
        const durationStr = probed?.metadata.duration;
        const duration =
          typeof durationStr === "string" || typeof durationStr === "number"
            ? BigInt(durationStr)
            : secondsToTicks(entry.fallbackKind === "image" ? 5 : 8);
        items.push(
          createMediaItem({
            kind: (probed?.kind as MediaKind) ?? entry.fallbackKind,
            name: entry.name,
            path: entry.path,
            metadata: {
              duration,
              hasVideo: entry.fallbackKind !== "audio",
              hasAudio: entry.fallbackKind !== "image",
              ...(entry.fallbackKind !== "audio"
                ? {
                    width: Number(probed?.metadata.width) || 1280,
                    height: Number(probed?.metadata.height) || 720,
                    frameRate: FRAME_RATES.fps25,
                  }
                : { audioChannels: 2, audioSampleRate: 48000 }),
            },
          }),
        );
      }
      get().importMediaItems(items);
      set({ selectedMediaId: items[0]!.id, status: "Loaded real demo media (ffmpeg)" });
    },

    dropMediaOnTimeline: (mediaId, trackId, startTicks) => {
      const { history, project, snapEnabled, playheadTicks } = get();
      const media = project.media.find((m) => m.id === mediaId);
      if (!media) return;
      const sequence = requireActiveSequence(project);
      let start = startTicks;
      if (snapEnabled) {
        start = snapTime(start, collectSnapTargets(sequence, playheadTicks), secondsToTicks(0.15));
      }
      const duration = media.metadata.duration > 0n ? media.metadata.duration : secondsToTicks(5);
      const clip = createClip({
        kind: media.kind === "audio" ? "audio" : media.kind === "image" ? "image" : "video",
        source: { type: "media", mediaId: media.id },
        start,
        duration,
        name: media.name,
      });
      history.push(new PlaceClipCommand(trackId, clip, "overwrite"));
      set({
        ...bump(sync(history), get().revision, `Placed ${media.name}`),
        selectedClipId: clip.id,
      });
    },

    splitAtPlayhead: () => {
      const { history, project, playheadTicks, selectedClipId, revision } = get();
      const sequence = requireActiveSequence(project);
      const tracks = [...sequence.videoTracks, ...sequence.audioTracks];
      for (const track of tracks) {
        for (const clip of track.clips) {
          if (selectedClipId && clip.id !== selectedClipId) continue;
          if (playheadTicks > clip.start && playheadTicks < clip.start + clip.duration) {
            history.push(new SplitClipCommand(track.id, clip.id, playheadTicks));
            set(bump(sync(history), revision, "Split"));
            return;
          }
        }
      }
    },

    liftSelected: () => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (track.clips.some((c) => c.id === selectedClipId)) {
          history.push(new LiftClipCommand(track.id, selectedClipId));
          set({ ...bump(sync(history), revision, "Lift"), selectedClipId: null });
          return;
        }
      }
    },

    extractSelected: () => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (track.clips.some((c) => c.id === selectedClipId)) {
          history.push(new ExtractClipCommand(track.id, selectedClipId));
          set({ ...bump(sync(history), revision, "Extract"), selectedClipId: null });
          return;
        }
      }
    },

    moveSelected: (newStart) => {
      const { history, project, selectedClipId, snapEnabled, playheadTicks, revision } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      let start = newStart;
      if (snapEnabled) {
        start = snapTime(start, collectSnapTargets(sequence, playheadTicks), secondsToTicks(0.1));
      }
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (track.clips.some((c) => c.id === selectedClipId)) {
          history.push(new MoveClipCommand(track.id, selectedClipId, start < 0n ? 0n : start));
          set(bump(sync(history), revision));
          return;
        }
      }
    },

    trimSelected: (patch) => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (track.clips.some((c) => c.id === selectedClipId)) {
          history.push(new TrimClipCommand(track.id, selectedClipId, patch));
          set(bump(sync(history), revision, "Trim"));
          return;
        }
      }
    },

    toggleTrackMute: (trackId) => {
      const { history, project, revision } = get();
      const sequence = requireActiveSequence(project);
      const track = [...sequence.videoTracks, ...sequence.audioTracks].find((t) => t.id === trackId);
      if (!track) return;
      history.push(new SetTrackFlagsCommand(trackId, { muted: !track.muted }));
      set(bump(sync(history), revision));
    },

    addMarkerAtPlayhead: () => {
      const { history, playheadTicks, revision } = get();
      history.push(new AddMarkerCommand(playheadTicks, "Marker"));
      set(bump(sync(history), revision, "Marker added"));
    },

    setSelectedSpeed: (speed) => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (track.clips.some((c) => c.id === selectedClipId)) {
          history.push(new SetClipSpeedCommand(track.id, selectedClipId, speed, true));
          set(bump(sync(history), revision, `Speed ${speed}x`));
          return;
        }
      }
    },

    queueExport: (presetId, outputPath, patentAcknowledged) => {
      try {
        const sequence = requireActiveSequence(get().project);
        const job = createExportJob({
          presetId,
          sequenceId: sequence.id,
          outputPath,
          patentAcknowledged,
        });
        set({
          exportQueue: [...get().exportQueue, job],
          status: `Queued export ${presetId}`,
        });
      } catch (err) {
        set({ status: err instanceof Error ? err.message : String(err) });
      }
    },

    runSequenceExport: async (outputPath, dryRun = false) => {
      const { project } = get();
      const sequence = requireActiveSequence(project);
      set({ status: dryRun ? "Building export graph…" : "Exporting sequence…" });
      const result = await exportSequenceApi({
        sequence,
        media: project.media,
        outputPath,
        dryRun,
      });
      if (!result.ok) {
        set({ status: result.error ?? "Export failed" });
        return;
      }
      set({
        status: dryRun
          ? `Export dry-run: ${result.description ?? "ok"}`
          : `Exported → ${outputPath}`,
      });
    },

    exportInterchange: (kind) => {
      const { project } = get();
      const sequence = requireActiveSequence(project);
      let text = "";
      if (kind === "edl") text = exportEdl(sequence, project.media);
      else if (kind === "fcpxml") text = exportFcpxml(sequence, project.media, project.name);
      else text = exportOtioJson(sequence, project.media);
      set({ interchangePreview: text, status: `Exported ${kind.toUpperCase()} to preview` });
    },

    maybeAutosave: () => {
      const { project, lastAutosaveAt } = get();
      if (!shouldAutosave(lastAutosaveAt, project.settings.autoSaveMinutes)) return;
      const snap = createAutosaveSnapshot(project, "interval");
      try {
        localStorage.setItem("lumina.autosave", snap.json);
        localStorage.setItem("lumina.autosave.at", snap.savedAt);
      } catch {
        // ignore quota
      }
      set({ lastAutosaveAt: snap.savedAt, status: `Autosaved ${snap.savedAt}` });
    },

    tickPlayback: (dtSeconds) => {
      if (!get().playing) return;
      const next = get().playheadTicks + secondsToTicks(dtSeconds);
      set({ playheadTicks: next });
      get().maybeAutosave();
    },
  };
});

export function formatTimecode(ticks: bigint, fps = 25): string {
  const totalFrames = Math.floor(ticksToSeconds(ticks) * fps);
  const f = totalFrames % fps;
  const totalSec = Math.floor(totalFrames / fps);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

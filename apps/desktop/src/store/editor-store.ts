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
  type Project,
  type MediaItem,
  type EditTool,
  type ExportJob,
  type ClipId,
} from "@lumina/core";
import type { Locale } from "@lumina/i18n";

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
  undo: () => void;
  redo: () => void;
  importMediaItems: (items: MediaItem[]) => void;
  addDemoMedia: () => void;
  dropMediaOnTimeline: (mediaId: string, trackId: string, startTicks: bigint) => void;
  splitAtPlayhead: () => void;
  liftSelected: () => void;
  extractSelected: () => void;
  moveSelected: (newStart: bigint) => void;
  trimSelected: (patch: { start?: bigint; duration?: bigint; inPoint?: bigint; outPoint?: bigint }) => void;
  toggleTrackMute: (trackId: string) => void;
  queueExport: (presetId: string, outputPath: string, patentAcknowledged: boolean) => void;
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
      const items: MediaItem[] = [
        createMediaItem({
          kind: "video",
          name: "Demo Bars.mp4",
          path: "demo://color-bars",
          metadata: {
            duration: secondsToTicks(12),
            width: 1920,
            height: 1080,
            frameRate: FRAME_RATES.fps25,
            hasVideo: true,
            hasAudio: true,
            videoCodec: "h264",
            audioCodec: "aac",
            audioChannels: 2,
            audioSampleRate: 48000,
          },
        }),
        createMediaItem({
          kind: "audio",
          name: "Demo Tone.wav",
          path: "demo://tone",
          metadata: {
            duration: secondsToTicks(12),
            hasVideo: false,
            hasAudio: true,
            audioCodec: "pcm",
            audioChannels: 2,
            audioSampleRate: 48000,
          },
        }),
        createMediaItem({
          kind: "image",
          name: "Still Gradient.png",
          path: "demo://gradient",
          metadata: {
            duration: secondsToTicks(5),
            width: 1920,
            height: 1080,
            hasVideo: true,
            hasAudio: false,
          },
        }),
      ];
      get().importMediaItems(items);
      set({ selectedMediaId: items[0]!.id });
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

    tickPlayback: (dtSeconds) => {
      if (!get().playing) return;
      const next = get().playheadTicks + secondsToTicks(dtSeconds);
      set({ playheadTicks: next });
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

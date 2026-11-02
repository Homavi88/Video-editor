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
  RippleTrimCommand,
  RollEditCommand,
  SlipEditCommand,
  SlideEditCommand,
  ApplyTransitionCommand,
  AddEffectCommand,
  SetBlendModeCommand,
  SwitchMulticamAngleCommand,
  AddTrackCommand,
  RemoveTrackCommand,
  PlaceAdjustmentClipCommand,
  SetSequenceInOutCommand,
  PasteAttributesCommand,
  SetEffectParamCommand,
  AddEffectKeyframeCommand,
  SetEffectEnabledCommand,
  extractClipAttributes,
  buildMulticamAngles,
  placeMulticamAngles,
  findMulticamStack,
  createProject,
  createClip,
  createMediaItem,
  createExportJob,
  requireActiveSequence,
  secondsToTicks,
  ticksToSeconds,
  snapTime,
  collectSnapTargets,
  clipEnd,
  FRAME_RATES,
  createAutosaveSnapshot,
  shouldAutosave,
  getHotkeyPreset,
  exportEdl,
  exportFcpxml,
  exportOtioJson,
  exportAafLite,
  classifyMediaKind,
  createWarmDemoLut,
  parseCubeLut,
  parseSrt,
  serializeSrt,
  ImportSubtitleCuesCommand,
  ReplaceClipMediaCommand,
  LinkClipsCommand,
  cuesAtTime,
  type Project,
  type MediaItem,
  type EditTool,
  type ExportJob,
  type ClipId,
  type HotkeyPresetId,
  type MediaKind,
  type BlendMode,
  type ClipAttributes,
  type Lut3D,
  type TrackKind,
  type SubtitleCue,
  type VolumePoint,
  sampleVolume,
  frameDurationTicks,
} from "@lumina/core";
import { detectScenesFromLuma } from "@lumina/ai";
import type { Locale } from "@lumina/i18n";
import {
  ensureDemoMedia,
  exportSequenceApi,
  fetchFrameObjectUrl,
  isFileBacked,
  probePath,
  scanWatchFolder,
} from "../lib/media-api";

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
  /** Soft mask applied in Program monitor preview (inspector-driven). */
  previewMask: import("@lumina/core").MaskShape | null;
  trackGains: Record<string, number>;
  vuLevels: Record<string, number>;
  titleOverlay: string | null;
  // actions
  setLocale: (locale: Locale) => void;
  setPreviewMask: (mask: import("@lumina/core").MaskShape | null) => void;
  setTrackGain: (trackId: string, gain: number) => void;
  setVuLevels: (levels: Record<string, number>) => void;
  setTitleOverlay: (text: string | null) => void;
  toggleTrackSolo: (trackId: string) => void;
  nestSelectedAsSequence: () => void;
  placeSelectedMediaAtPlayhead: () => void;
  attachProxyToMedia: (mediaId: string, proxyPath: string) => void;
  applyTransitionPreset: (presetId: string) => void;
  updateMediaTags: (mediaId: string, tags: readonly string[]) => void;
  addEffectToSelected: (typeId: string) => void;
  setSelectedBlendMode: (mode: BlendMode) => void;
  buildMulticamFromPool: () => void;
  switchMulticamAngle: (angleIndex: number) => void;
  importWatchFolder: (dir: string) => Promise<void>;
  watchFolders: string[];
  addWatchFolder: (dir: string) => void;
  layoutPrefs: { poolWidth: number; inspectorWidth: number };
  setLayoutPrefs: (patch: Partial<{ poolWidth: number; inspectorWidth: number }>) => void;
  multicamAngle: number;
  activeLut: Lut3D | null;
  lutStrength: number;
  copiedAttributes: ClipAttributes | null;
  sourceInSec: number;
  sourceOutSec: number;
  floatingInspector: boolean;
  setActiveLut: (lut: Lut3D | null) => void;
  setLutStrength: (v: number) => void;
  loadDemoLut: () => void;
  addTrack: (kind: TrackKind) => void;
  removeTrack: (trackId: string) => void;
  placeAdjustmentLayer: () => void;
  setSequenceInOut: (inPoint: bigint | null, outPoint: bigint | null) => void;
  copySelectedAttributes: () => void;
  pasteAttributesToSelected: () => void;
  setSourceInOut: (mark: "in" | "out", seconds: number) => void;
  threePointInsert: () => void;
  setFloatingInspector: (v: boolean) => void;
  transitionDurationSec: number;
  setTransitionDurationSec: (v: number) => void;
  setEffectParam: (effectId: string, paramKey: string, value: number) => void;
  addEffectKeyframeAtPlayhead: (effectId: string, paramKey: string, value: number) => void;
  setEffectEnabled: (effectId: string, enabled: boolean) => void;
  loadCubeLutText: (text: string) => void;
  zoomToFit: () => void;
  zoomToPlayhead: () => void;
  compareSplit: boolean;
  setCompareSplit: (v: boolean) => void;
  showSafeZones: boolean;
  setShowSafeZones: (v: boolean) => void;
  subtitleCues: SubtitleCue[];
  importSrtText: (text: string) => void;
  exportSrtPreview: () => string;
  activeSubtitleText: () => string | null;
  replaceSelectedWithMedia: () => void;
  linkSelectedAv: () => void;
  unlinkSelected: () => void;
  previewScopeRgba: { width: number; height: number; data: Uint8Array } | null;
  setPreviewScopeRgba: (frame: { width: number; height: number; data: Uint8Array } | null) => void;
  clipVolumePoints: Record<string, VolumePoint[]>;
  setClipVolumePoint: (clipId: string, time: bigint, gain: number) => void;
  sampleClipGain: (clipId: string, time: bigint) => number;
  detectScenesOnSelected: () => Promise<void>;
  loopPlayback: boolean;
  setLoopPlayback: (v: boolean) => void;
  reverseSelected: () => void;
  duckingEnabled: boolean;
  setDuckingEnabled: (v: boolean) => void;
  exportWorkAreaOnly: boolean;
  setExportWorkAreaOnly: (v: boolean) => void;
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
  processExportQueue: () => Promise<void>;
  runSequenceExport: (outputPath: string, dryRun?: boolean) => Promise<void>;
  exportInterchange: (kind: "edl" | "fcpxml" | "otio" | "aaf") => void;
  maybeAutosave: () => void;
  tickPlayback: (dtSeconds: number) => void;
  rippleTrimSelected: (edge: "in" | "out", newEdgeTime: bigint) => void;
  rollSelectedEdit: (newEditTime: bigint) => void;
  slipSelected: (deltaSourceTicks: bigint) => void;
  slideSelected: (newStart: bigint) => void;
  applyDefaultTransition: () => void;
}

function sync(history: HistoryStack): Project {
  return history.current;
}

/** Dedupes StrictMode / overlapping startup imports. */
let demoMediaInflight: Promise<void> | null = null;

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
    previewMask: null,
    trackGains: {},
    vuLevels: {},
    titleOverlay: null,
    watchFolders: [],
    layoutPrefs: { poolWidth: 260, inspectorWidth: 280 },
    multicamAngle: 0,
    activeLut: null,
    lutStrength: 1,
    copiedAttributes: null,
    sourceInSec: 0,
    sourceOutSec: 5,
    floatingInspector: false,
    transitionDurationSec: 1,
    compareSplit: false,
    showSafeZones: false,
    subtitleCues: [],
    previewScopeRgba: null,
    clipVolumePoints: {},
    loopPlayback: false,
    duckingEnabled: false,
    exportWorkAreaOnly: false,

    setLocale: (locale) => set({ locale }),
    setLoopPlayback: (v) => set({ loopPlayback: v }),
    setDuckingEnabled: (v) => set({ duckingEnabled: v, status: v ? "Ducking on" : "Ducking off" }),
    setExportWorkAreaOnly: (v) => set({ exportWorkAreaOnly: v }),
    reverseSelected: () => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        const clip = track.clips.find((c) => c.id === selectedClipId);
        if (!clip) continue;
        const next = clip.speed === 0 ? -1 : -clip.speed;
        history.push(new SetClipSpeedCommand(track.id, selectedClipId, next, true));
        set(bump(sync(history), revision, `Speed ${next}x`));
        return;
      }
    },
    setShowSafeZones: (v) => set({ showSafeZones: v }),
    setPreviewScopeRgba: (frame) => set({ previewScopeRgba: frame }),
    setClipVolumePoint: (clipId, time, gain) => {
      const prev = get().clipVolumePoints[clipId] ?? [{ time: 0n, gain: 1 }];
      const next = [...prev.filter((p) => p.time !== time), { time, gain: Math.max(0, gain) }].sort(
        (a, b) => (a.time < b.time ? -1 : 1),
      );
      set({
        clipVolumePoints: { ...get().clipVolumePoints, [clipId]: next },
        status: `Volume KF @ ${ticksToSeconds(time).toFixed(2)}s`,
      });
    },
    sampleClipGain: (clipId, time) => {
      const pts = get().clipVolumePoints[clipId];
      if (!pts?.length) return 1;
      return sampleVolume(
        pts.map((p) => ({
          id: `vk-${String(p.time)}` as never,
          time: p.time,
          value: p.gain,
          interpolation: "linear" as const,
        })),
        time,
      );
    },
    detectScenesOnSelected: async () => {
      const { selectedMediaId, project, history } = get();
      const media = project.media.find((m) => m.id === selectedMediaId);
      if (!media || !isFileBacked(media.path) || media.kind === "audio") {
        set({ status: "Select a video media item for scene detect" });
        return;
      }
      set({ status: "Detecting scenes…" });
      const duration = Math.min(12, Math.max(2, ticksToSeconds(media.metadata.duration) || 8));
      const step = 0.25;
      const lumas: number[] = [];
      for (let t = 0; t < duration; t += step) {
        const url = await fetchFrameObjectUrl(media.path, t, 160, 90);
        if (!url) {
          lumas.push(lumas[lumas.length - 1] ?? 0.2);
          continue;
        }
        const luma = await averageLumaFromUrl(url);
        URL.revokeObjectURL(url);
        lumas.push(luma);
      }
      const cuts = detectScenesFromLuma(lumas, frameDurationTicks(FRAME_RATES.fps25) * 6n, 0.18);
      for (const cut of cuts.slice(0, 24)) {
        history.push(new AddMarkerCommand(cut.time, `Scene ${cut.score.toFixed(2)}`, "orange"));
      }
      set({
        ...bump(sync(history), get().revision, `Scene detect: ${cuts.length} cuts → markers`),
      });
    },
    importSrtText: (text) => {
      try {
        const cues = parseSrt(text);
        const { history, revision } = get();
        history.push(new ImportSubtitleCuesCommand(cues));
        set({
          ...bump(sync(history), revision, `Imported ${cues.length} cues`),
          subtitleCues: cues,
        });
      } catch (err) {
        set({ status: err instanceof Error ? err.message : String(err) });
      }
    },
    exportSrtPreview: () => {
      const cues = get().subtitleCues;
      if (cues.length) return serializeSrt(cues);
      // Fall back to subtitle track clip names as cues.
      const sequence = requireActiveSequence(get().project);
      const rebuilt: SubtitleCue[] = sequence.subtitleTracks.flatMap((tr) =>
        tr.clips.map((c) => ({
          id: c.id as unknown as SubtitleCue["id"],
          start: c.start,
          end: clipEnd(c),
          text: c.name,
        })),
      );
      return serializeSrt(rebuilt);
    },
    activeSubtitleText: () => {
      const { subtitleCues, playheadTicks, project } = get();
      if (subtitleCues.length) {
        const texts = cuesAtTime(subtitleCues, playheadTicks);
        return texts[0] ?? null;
      }
      const sequence = requireActiveSequence(project);
      for (const tr of sequence.subtitleTracks) {
        if (tr.hidden || tr.muted) continue;
        for (const c of tr.clips) {
          if (playheadTicks >= c.start && playheadTicks < clipEnd(c)) return c.name;
        }
      }
      return null;
    },
    replaceSelectedWithMedia: () => {
      const { history, project, selectedClipId, selectedMediaId, revision } = get();
      if (!selectedClipId || !selectedMediaId) {
        set({ status: "Select clip + media to replace" });
        return;
      }
      const media = project.media.find((m) => m.id === selectedMediaId);
      if (!media) return;
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (!track.clips.some((c) => c.id === selectedClipId)) continue;
        history.push(
          new ReplaceClipMediaCommand(track.id, selectedClipId, media.id, media.name),
        );
        set(bump(sync(history), revision, `Replaced with ${media.name}`));
        return;
      }
    },
    linkSelectedAv: () => {
      const { history, project, selectedClipId, playheadTicks, revision } = get();
      if (!selectedClipId) {
        set({ status: "Select a clip to link A/V" });
        return;
      }
      const sequence = requireActiveSequence(project);
      const all = [...sequence.videoTracks, ...sequence.audioTracks].flatMap((tr) =>
        tr.clips.map((c) => ({ clip: c, track: tr })),
      );
      const selected = all.find((x) => x.clip.id === selectedClipId);
      if (!selected) return;
      // Link clips that overlap the selected clip (or playhead) across V/A.
      const start = selected.clip.start;
      const end = clipEnd(selected.clip);
      const group = all
        .filter(
          (x) =>
            x.clip.id === selectedClipId ||
            (x.clip.start < end && clipEnd(x.clip) > start) ||
            (playheadTicks >= x.clip.start && playheadTicks < clipEnd(x.clip)),
        )
        .map((x) => x.clip.id);
      if (group.length < 2) {
        set({ status: "Need overlapping V+A clips to link" });
        return;
      }
      history.push(new LinkClipsCommand(group, true));
      set(bump(sync(history), revision, `Linked ${group.length} clips`));
    },
    unlinkSelected: () => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      const clip = [...sequence.videoTracks, ...sequence.audioTracks]
        .flatMap((t) => t.clips)
        .find((c) => c.id === selectedClipId);
      if (!clip) return;
      const ids = [clip.id, ...clip.linkedClipIds];
      history.push(new LinkClipsCommand(ids, false));
      set(bump(sync(history), revision, "Unlinked"));
    },
    setActiveLut: (lut) => set({ activeLut: lut }),
    setLutStrength: (v) => set({ lutStrength: Math.min(1, Math.max(0, v)) }),
    loadDemoLut: () => set({ activeLut: createWarmDemoLut(17), status: "Loaded warm demo LUT" }),
    loadCubeLutText: (text) => {
      try {
        const lut = parseCubeLut(text);
        set({ activeLut: lut, status: `Loaded LUT ${lut.title} (${lut.size}³)` });
      } catch (err) {
        set({ status: err instanceof Error ? err.message : String(err) });
      }
    },
    setFloatingInspector: (v) => set({ floatingInspector: v }),
    setTransitionDurationSec: (v) => set({ transitionDurationSec: Math.max(0.1, v) }),
    setCompareSplit: (v) => set({ compareSplit: v }),
    zoomToFit: () => {
      const sequence = requireActiveSequence(get().project);
      const ends = [...sequence.videoTracks, ...sequence.audioTracks].flatMap((tr) =>
        tr.clips.map((c) => ticksToSeconds(clipEnd(c))),
      );
      const dur = Math.max(8, ...ends, 1);
      // Fit ~duration into ~900px effective timeline width.
      const zoom = Math.min(300, Math.max(20, Math.floor(900 / dur)));
      set({ zoom, status: `Zoom to fit (${zoom}px/s)` });
    },
    zoomToPlayhead: () => {
      set({ zoom: Math.min(300, Math.max(get().zoom, 160)), status: "Zoom to playhead" });
    },
    setEffectParam: (effectId, paramKey, value) => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (!track.clips.some((c) => c.id === selectedClipId)) continue;
        history.push(
          new SetEffectParamCommand(track.id, selectedClipId, effectId, paramKey, value),
        );
        set(bump(sync(history), revision));
        return;
      }
    },
    addEffectKeyframeAtPlayhead: (effectId, paramKey, value) => {
      const { history, project, selectedClipId, playheadTicks, revision } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (!track.clips.some((c) => c.id === selectedClipId)) continue;
        history.push(
          new AddEffectKeyframeCommand(
            track.id,
            selectedClipId,
            effectId,
            paramKey,
            playheadTicks,
            value,
          ),
        );
        set(bump(sync(history), revision, `KF ${paramKey}`));
        return;
      }
    },
    setEffectEnabled: (effectId, enabled) => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (!track.clips.some((c) => c.id === selectedClipId)) continue;
        history.push(new SetEffectEnabledCommand(track.id, selectedClipId, effectId, enabled));
        set(bump(sync(history), revision, enabled ? "FX on" : "FX off"));
        return;
      }
    },
    setSourceInOut: (mark, seconds) => {
      if (mark === "in") set({ sourceInSec: Math.max(0, seconds) });
      else set({ sourceOutSec: Math.max(get().sourceInSec + 0.04, seconds) });
    },
    addTrack: (kind) => {
      const { history, revision } = get();
      history.push(new AddTrackCommand(kind));
      set(bump(sync(history), revision, `Added ${kind} track`));
    },
    removeTrack: (trackId) => {
      const { history, revision } = get();
      history.push(new RemoveTrackCommand(trackId));
      set(bump(sync(history), revision, "Removed track"));
    },
    placeAdjustmentLayer: () => {
      const { history, project, playheadTicks, revision } = get();
      let sequence = requireActiveSequence(project);
      let adj = sequence.videoTracks.find((t) => t.kind === "adjustment");
      if (!adj) {
        history.push(new AddTrackCommand("adjustment"));
        sequence = requireActiveSequence(sync(history));
        adj = sequence.videoTracks.find((t) => t.kind === "adjustment");
      }
      if (!adj) return;
      const dur = secondsToTicks(5);
      history.push(new PlaceAdjustmentClipCommand(adj.id, playheadTicks, dur));
      set(bump(sync(history), revision, "Adjustment layer placed"));
    },
    setSequenceInOut: (inPoint, outPoint) => {
      const { history, revision } = get();
      history.push(new SetSequenceInOutCommand(inPoint, outPoint));
      set(bump(sync(history), revision, "Sequence In/Out set"));
    },
    copySelectedAttributes: () => {
      const { project, selectedClipId } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        const clip = track.clips.find((c) => c.id === selectedClipId);
        if (!clip) continue;
        set({
          copiedAttributes: extractClipAttributes(clip),
          status: "Attributes copied",
        });
        return;
      }
    },
    pasteAttributesToSelected: () => {
      const { history, project, selectedClipId, copiedAttributes, revision } = get();
      if (!selectedClipId || !copiedAttributes) {
        set({ status: "Nothing to paste" });
        return;
      }
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (!track.clips.some((c) => c.id === selectedClipId)) continue;
        history.push(new PasteAttributesCommand(track.id, selectedClipId, copiedAttributes));
        set(bump(sync(history), revision, "Attributes pasted"));
        return;
      }
    },
    threePointInsert: () => {
      const { selectedMediaId, project, sourceInSec, sourceOutSec, playheadTicks } = get();
      if (!selectedMediaId) {
        set({ status: "Select media for 3-point insert" });
        return;
      }
      const media = project.media.find((m) => m.id === selectedMediaId);
      if (!media) return;
      const sequence = requireActiveSequence(project);
      const trackId =
        media.kind === "audio"
          ? sequence.audioTracks[0]!.id
          : sequence.videoTracks[sequence.videoTracks.length - 1]!.id;
      const inTicks = secondsToTicks(sourceInSec);
      const outTicks = secondsToTicks(sourceOutSec);
      const duration = outTicks > inTicks ? outTicks - inTicks : secondsToTicks(5);
      const clip = createClip({
        kind: media.kind === "audio" ? "audio" : media.kind === "image" ? "image" : "video",
        source: { type: "media", mediaId: media.id },
        start: playheadTicks,
        duration,
        inPoint: inTicks,
        outPoint: inTicks + duration,
        name: media.name,
      });
      get().history.push(new PlaceClipCommand(trackId, clip, "overwrite"));
      set({
        ...bump(sync(get().history), get().revision, `3-point insert ${media.name}`),
        selectedClipId: clip.id,
      });
    },
    setLayoutPrefs: (patch) =>
      set({ layoutPrefs: { ...get().layoutPrefs, ...patch } }),
    addWatchFolder: (dir) => {
      if (!dir) return;
      const watchFolders = Array.from(new Set([...get().watchFolders, dir]));
      set({ watchFolders, status: `Watching ${dir}` });
      void get().importWatchFolder(dir);
    },
    importWatchFolder: async (dir) => {
      const files = await scanWatchFolder(dir);
      const existing = new Set(get().project.media.map((m) => m.path));
      const items: MediaItem[] = [];
      for (const p of files) {
        if (existing.has(p)) continue;
        const kind = classifyMediaKind(p) as MediaKind;
        const probed = await probePath(p);
        const durationStr = probed?.metadata.duration;
        const duration =
          typeof durationStr === "string" || typeof durationStr === "number"
            ? BigInt(durationStr)
            : secondsToTicks(kind === "image" ? 5 : 10);
        const name = p.split(/[\\/]/).pop() || p;
        items.push(
          createMediaItem({
            kind,
            name,
            path: p,
            metadata: {
              duration,
              hasVideo: kind !== "audio",
              hasAudio: kind !== "image",
              ...(kind === "audio"
                ? { audioChannels: 2, audioSampleRate: 48000 }
                : {
                    width: Number(probed?.metadata.width) || 1920,
                    height: Number(probed?.metadata.height) || 1080,
                    frameRate: FRAME_RATES.fps25,
                  }),
            },
            tags: ["watched"],
          }),
        );
      }
      if (items.length) {
        get().importMediaItems(items);
        set({ status: `Watch-folder imported ${items.length} from ${dir}` });
      } else {
        set({ status: `Watch-folder: no new files in ${dir}` });
      }
    },
    addEffectToSelected: (typeId) => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) {
        set({ status: "Select a clip to add effect" });
        return;
      }
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (!track.clips.some((c) => c.id === selectedClipId)) continue;
        try {
          history.push(new AddEffectCommand(track.id, selectedClipId, typeId));
          set(bump(sync(history), revision, `FX ${typeId}`));
        } catch (err) {
          set({ status: err instanceof Error ? err.message : String(err) });
        }
        return;
      }
    },
    setSelectedBlendMode: (mode) => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (!track.clips.some((c) => c.id === selectedClipId)) continue;
        history.push(new SetBlendModeCommand(track.id, selectedClipId, mode));
        set(bump(sync(history), revision, `Blend ${mode}`));
        return;
      }
    },
    buildMulticamFromPool: () => {
      const { project, playheadTicks } = get();
      const angles = buildMulticamAngles(project.media);
      if (angles.length < 2) {
        set({ status: "Need ≥2 video clips in pool for multicam" });
        return;
      }
      const duration = secondsToTicks(8);
      const next = placeMulticamAngles(project, angles.slice(0, 3), playheadTicks, duration);
      get().history.reset(next);
      set({
        project: next,
        revision: get().revision + 1,
        multicamAngle: 0,
        status: `Multicam stack: ${Math.min(3, angles.length)} angles`,
      });
    },
    switchMulticamAngle: (angleIndex) => {
      const { history, project, revision } = get();
      const sequence = requireActiveSequence(project);
      const stack = findMulticamStack(sequence);
      if (!stack) {
        set({ status: "No multicam stack — use Multicam from Media Pool" });
        return;
      }
      history.push(new SwitchMulticamAngleCommand(angleIndex, stack.trackIds));
      set({
        ...bump(sync(history), revision, `Angle ${angleIndex + 1}`),
        multicamAngle: angleIndex,
      });
    },
    setPreviewMask: (mask) => set({ previewMask: mask }),
    setTrackGain: (trackId, gain) =>
      set({ trackGains: { ...get().trackGains, [trackId]: Math.min(2, Math.max(0, gain)) } }),
    setVuLevels: (levels) => set({ vuLevels: levels }),
    setTitleOverlay: (text) => set({ titleOverlay: text }),
    toggleTrackSolo: (trackId) => {
      const { history, project, revision } = get();
      const sequence = requireActiveSequence(project);
      const track = [...sequence.videoTracks, ...sequence.audioTracks].find((t) => t.id === trackId);
      if (!track) return;
      history.push(new SetTrackFlagsCommand(trackId, { solo: !track.solo }));
      set(bump(sync(history), revision, track.solo ? "Solo off" : "Solo on"));
    },
    nestSelectedAsSequence: () => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) {
        set({ status: "Select a clip to nest" });
        return;
      }
      const sequence = requireActiveSequence(project);
      const found = [...sequence.videoTracks, ...sequence.audioTracks]
        .flatMap((tr) => tr.clips.map((c) => ({ clip: c, track: tr })))
        .find((x) => x.clip.id === selectedClipId);
      if (!found) return;
      const nested = createProject({ name: `Nested ${found.clip.name}` }).sequences[0]!;
      const withNested = { ...project, sequences: [...project.sequences, nested] };
      history.reset(withNested);
      const trackId = found.track.id;
      history.push(new LiftClipCommand(trackId, selectedClipId));
      const nestedClip = createClip({
        kind: found.clip.kind,
        source: { type: "sequence", sequenceId: nested.id },
        start: found.clip.start,
        duration: found.clip.duration,
        name: `◆ ${found.clip.name}`,
      });
      history.push(new PlaceClipCommand(trackId, nestedClip, "overwrite"));
      set({
        ...bump(sync(history), revision, `Nested → ${nested.name}`),
        selectedClipId: nestedClip.id,
      });
    },
    applyTransitionPreset: (presetId) => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) {
        set({ status: "Select a clip to apply transition" });
        return;
      }
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (!track.clips.some((c) => c.id === selectedClipId)) continue;
        history.push(new ApplyTransitionCommand(track.id, selectedClipId, presetId, "out"));
        set(bump(sync(history), revision, `Transition ${presetId}`));
        return;
      }
    },
    updateMediaTags: (mediaId, tags) => {
      const { project, revision } = get();
      const media = project.media.map((m) => (m.id === mediaId ? { ...m, tags: [...tags] } : m));
      const next = { ...project, media };
      get().history.reset(next);
      set({ project: next, revision: revision + 1 });
    },
    placeSelectedMediaAtPlayhead: () => {
      const { selectedMediaId, project, playheadTicks } = get();
      if (!selectedMediaId) return;
      const media = project.media.find((m) => m.id === selectedMediaId);
      if (!media) return;
      const sequence = requireActiveSequence(project);
      const trackId =
        media.kind === "audio"
          ? sequence.audioTracks[0]!.id
          : sequence.videoTracks[sequence.videoTracks.length - 1]!.id;
      get().dropMediaOnTimeline(selectedMediaId, trackId, playheadTicks);
    },
    attachProxyToMedia: (mediaId, proxyPath) => {
      const { project, revision } = get();
      const media = project.media.map((m) =>
        m.id === mediaId
          ? {
              ...m,
              proxy: {
                path: proxyPath,
                width: 1280,
                height: 720,
                videoCodec: "h264",
              },
            }
          : m,
      );
      const next = { ...project, media };
      get().history.reset(next);
      set({ project: next, revision: revision + 1, status: `Proxy attached: ${proxyPath}` });
    },
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
      if (get().project.media.length > 0) return;
      if (demoMediaInflight) return demoMediaInflight;
      demoMediaInflight = (async () => {
        try {
          if (get().project.media.length > 0) return;
          const demo = await ensureDemoMedia();
          if (get().project.media.length > 0) return;
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
          if (get().project.media.length > 0) return;
          get().importMediaItems(items);
          const loaded = get().project.media;
          const video = loaded.find((m) => m.kind === "video");
          const audio = loaded.find((m) => m.kind === "audio");
          const sequence = requireActiveSequence(get().project);
          const hasClips = [...sequence.videoTracks, ...sequence.audioTracks].some(
            (tr) => tr.clips.length > 0,
          );
          if (!hasClips && video) {
            const vTrack = sequence.videoTracks[sequence.videoTracks.length - 1]!;
            get().dropMediaOnTimeline(video.id, vTrack.id, 0n);
          }
          if (!hasClips && audio) {
            const aTrack = requireActiveSequence(get().project).audioTracks[0]!;
            get().dropMediaOnTimeline(audio.id, aTrack.id, 0n);
          }
          set({
            selectedMediaId: items[0]!.id,
            status: "Loaded real demo media (ffmpeg) · placed on V1/A1",
          });
        } finally {
          demoMediaInflight = null;
        }
      })();
      return demoMediaInflight;
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
        void get().processExportQueue();
      } catch (err) {
        set({ status: err instanceof Error ? err.message : String(err) });
      }
    },

    processExportQueue: async () => {
      const running = get().exportQueue.some((j) => j.status === "running");
      if (running) return;
      const next = get().exportQueue.find((j) => j.status === "queued");
      if (!next) return;

      const mark = (id: string, patch: Partial<ExportJob>) => {
        set({
          exportQueue: get().exportQueue.map((j) => (j.id === id ? { ...j, ...patch } : j)),
        });
      };

      mark(next.id, { status: "running", progress: 0.05, error: null });
      set({ status: `Exporting ${next.presetId}…` });
      try {
        const { project } = get();
        const sequence = requireActiveSequence(project);
        mark(next.id, { progress: 0.35 });
        const result = await exportSequenceApi({
          sequence: applyWorkArea(sequence, get().exportWorkAreaOnly),
          media: project.media,
          outputPath: next.outputPath,
          dryRun: false,
          // Let media-client infer concat vs overlay (gaps / multi-track).
          preferredFadeSeconds: get().transitionDurationSec,
        });
        if (!result.ok) {
          mark(next.id, {
            status: "failed",
            progress: 1,
            error: result.error ?? "Export failed",
          });
          set({ status: result.error ?? "Export failed" });
        } else {
          mark(next.id, { status: "completed", progress: 1, etaSeconds: 0 });
          set({
            status: `Queue done [${result.encoder ?? "libx264"}] → ${next.outputPath}`,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        mark(next.id, { status: "failed", progress: 1, error: msg });
        set({ status: msg });
      }
      // Drain remaining queued jobs sequentially.
      void get().processExportQueue();
    },

    rippleTrimSelected: (edge, newEdgeTime) => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (!track.clips.some((c) => c.id === selectedClipId)) continue;
        try {
          history.push(new RippleTrimCommand(track.id, selectedClipId, edge, newEdgeTime));
          set(bump(sync(history), revision, `Ripple ${edge}`));
        } catch (err) {
          set({ status: err instanceof Error ? err.message : String(err) });
        }
        return;
      }
    },

    rollSelectedEdit: (newEditTime) => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        const sorted = [...track.clips].sort((a, b) => (a.start < b.start ? -1 : 1));
        const idx = sorted.findIndex((c) => c.id === selectedClipId);
        if (idx < 0) continue;
        const left = sorted[idx]!;
        const right = sorted[idx + 1];
        // Prefer roll at out-point of selected when a right neighbor is adjacent.
        if (right && clipEnd(left) === right.start) {
          try {
            history.push(new RollEditCommand(track.id, left.id, right.id, newEditTime));
            set(bump(sync(history), revision, "Roll"));
          } catch (err) {
            set({ status: err instanceof Error ? err.message : String(err) });
          }
          return;
        }
        const prev = sorted[idx - 1];
        if (prev && clipEnd(prev) === left.start) {
          try {
            history.push(new RollEditCommand(track.id, prev.id, left.id, newEditTime));
            set(bump(sync(history), revision, "Roll"));
          } catch (err) {
            set({ status: err instanceof Error ? err.message : String(err) });
          }
          return;
        }
        set({ status: "Roll needs an adjacent edit point" });
        return;
      }
    },

    slipSelected: (deltaSourceTicks) => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (!track.clips.some((c) => c.id === selectedClipId)) continue;
        try {
          history.push(new SlipEditCommand(track.id, selectedClipId, deltaSourceTicks));
          set(bump(sync(history), revision, "Slip"));
        } catch (err) {
          set({ status: err instanceof Error ? err.message : String(err) });
        }
        return;
      }
    },

    slideSelected: (newStart) => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) return;
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (!track.clips.some((c) => c.id === selectedClipId)) continue;
        try {
          history.push(new SlideEditCommand(track.id, selectedClipId, newStart));
          set(bump(sync(history), revision, "Slide"));
        } catch (err) {
          set({ status: err instanceof Error ? err.message : String(err) });
        }
        return;
      }
    },

    applyDefaultTransition: () => {
      const { history, project, selectedClipId, revision } = get();
      if (!selectedClipId) {
        set({ status: "Select a clip to apply Cross Dissolve" });
        return;
      }
      const sequence = requireActiveSequence(project);
      for (const track of [...sequence.videoTracks, ...sequence.audioTracks]) {
        if (!track.clips.some((c) => c.id === selectedClipId)) continue;
        history.push(new ApplyTransitionCommand(track.id, selectedClipId, "crossDissolve", "out"));
        set(bump(sync(history), revision, "Cross Dissolve on out"));
        return;
      }
    },

    runSequenceExport: async (outputPath, dryRun = false) => {
      const { project } = get();
      const sequence = requireActiveSequence(project);
      set({ status: dryRun ? "Building export graph…" : "Exporting sequence…" });
      const result = await exportSequenceApi({
        sequence: applyWorkArea(sequence, get().exportWorkAreaOnly),
        media: project.media,
        outputPath,
        dryRun,
        preferredFadeSeconds: get().transitionDurationSec,
      });
      if (!result.ok) {
        set({ status: result.error ?? "Export failed" });
        return;
      }
      set({
        status: dryRun
          ? `Export dry-run (${result.encoder ?? "auto"}): ${result.description ?? "ok"}`
          : `Exported [${result.encoder ?? "libx264"}] → ${outputPath}`,
      });
    },

    exportInterchange: (kind) => {
      const { project } = get();
      const sequence = requireActiveSequence(project);
      let text = "";
      if (kind === "edl") text = exportEdl(sequence, project.media);
      else if (kind === "fcpxml") text = exportFcpxml(sequence, project.media, project.name);
      else if (kind === "aaf") text = exportAafLite(sequence, project.media, project.name);
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
      let next = get().playheadTicks + secondsToTicks(dtSeconds);
      const { loopPlayback, project, exportWorkAreaOnly } = get();
      const sequence = requireActiveSequence(project);
      const ends = [...sequence.videoTracks, ...sequence.audioTracks].flatMap((tr) =>
        tr.clips.map((c) => clipEnd(c)),
      );
      let loopEnd =
        ends.length > 0 ? ends.reduce((a, b) => (a > b ? a : b)) : secondsToTicks(10);
      let loopStart = 0n;
      if (exportWorkAreaOnly || loopPlayback) {
        if (sequence.inPoint !== null) loopStart = sequence.inPoint;
        if (sequence.outPoint !== null) loopEnd = sequence.outPoint;
      }
      if (loopPlayback && next >= loopEnd) {
        next = loopStart;
      }
      set({ playheadTicks: next < 0n ? 0n : next });
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

/** Shifts/clips timeline content into [in,out) when work-area export is enabled. */
function applyWorkArea(
  sequence: import("@lumina/core").Sequence,
  enabled: boolean,
): import("@lumina/core").Sequence {
  if (!enabled || sequence.inPoint === null || sequence.outPoint === null) return sequence;
  const inP = sequence.inPoint;
  const outP = sequence.outPoint;
  if (outP <= inP) return sequence;
  const mapTrack = (track: import("@lumina/core").Track): import("@lumina/core").Track => ({
    ...track,
    clips: track.clips
      .map((c) => {
        const end = clipEnd(c);
        if (end <= inP || c.start >= outP) return null;
        const newStart = c.start < inP ? 0n : c.start - inP;
        const trimIn = c.start < inP ? inP - c.start : 0n;
        const visibleEnd = end < outP ? end : outP;
        const newDur = visibleEnd - (c.start < inP ? inP : c.start);
        if (newDur <= 0n) return null;
        return {
          ...c,
          start: newStart,
          duration: newDur,
          inPoint: c.inPoint + trimIn,
          outPoint: c.inPoint + trimIn + newDur,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null),
  });
  return {
    ...sequence,
    videoTracks: sequence.videoTracks.map(mapTrack),
    audioTracks: sequence.audioTracks.map(mapTrack),
    subtitleTracks: sequence.subtitleTracks.map(mapTrack),
    inPoint: null,
    outPoint: null,
  };
}

async function averageLumaFromUrl(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 80;
      c.height = 45;
      const ctx = c.getContext("2d");
      if (!ctx) {
        resolve(0.2);
        return;
      }
      ctx.drawImage(img, 0, 0, 80, 45);
      const data = ctx.getImageData(0, 0, 80, 45).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!) / 255;
      }
      resolve(sum / (data.length / 4));
    };
    img.onerror = () => resolve(0.2);
    img.src = url;
  });
}

/**
 * Web Audio timeline playback: schedules file-backed audio clips, drives VU levels.
 */
import { useEffect, useRef } from "react";
import {
  requireActiveSequence,
  ticksToSeconds,
  clipEnd,
  timelineToSourceTime,
} from "@lumina/core";
import { useEditorStore } from "../store/editor-store";
import { isFileBacked, mediaStreamUrl } from "../lib/media-api";

export function useTimelineAudio(): void {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const elementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const gainsRef = useRef<Map<string, GainNode>>(new Map());

  useEffect(() => {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.connect(ctx.destination);
    ctxRef.current = ctx;
    masterRef.current = master;

    let raf = 0;
    const pump = () => {
      const store = useEditorStore.getState();
      const { playing, playheadTicks, project, trackGains, setVuLevels, sampleClipGain } = store;
      const sequence = requireActiveSequence(project);
      const anySolo = sequence.audioTracks.some((t) => t.solo);
      const levels: Record<string, number> = {};

      if (ctx.state === "suspended" && playing) void ctx.resume();

      for (const track of sequence.audioTracks) {
        const analyser = analysersRef.current.get(track.id);
        if (analyser) {
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (let i = 0; i < data.length; i += 1) {
            const v = Math.abs((data[i]! - 128) / 128);
            if (v > peak) peak = v;
          }
          levels[track.id] = track.muted || (anySolo && !track.solo) ? 0 : peak;
        } else {
          levels[track.id] = 0;
        }

        // Keep at most one active clip element per track synced to playhead.
        const clip = track.clips.find(
          (c) => c.enabled && playheadTicks >= c.start && playheadTicks < clipEnd(c),
        );

        const gainNode = gainsRef.current.get(track.id);
        if (gainNode) {
          const userGain = trackGains[track.id] ?? 1;
          const clipGain = clip ? sampleClipGain(clip.id, playheadTicks - clip.start) : 1;
          const silent = track.muted || (anySolo && !track.solo) || !playing;
          gainNode.gain.value = silent ? 0 : userGain * clipGain;
        }

        if (!clip || clip.source.type !== "media") {
          const el = elementsRef.current.get(track.id);
          if (el && !el.paused) el.pause();
          continue;
        }
        const mediaId = clip.source.mediaId;
        const media = project.media.find((m) => m.id === mediaId);
        if (!media || !isFileBacked(media.path) || !media.metadata.hasAudio) continue;

        let el = elementsRef.current.get(track.id);
        if (!el) {
          el = new Audio();
          el.crossOrigin = "anonymous";
          el.preload = "auto";
          const src = ctx.createMediaElementSource(el);
          const g = ctx.createGain();
          const a = ctx.createAnalyser();
          a.fftSize = 256;
          src.connect(g);
          g.connect(a);
          a.connect(master);
          gainsRef.current.set(track.id, g);
          analysersRef.current.set(track.id, a);
          elementsRef.current.set(track.id, el);
        }
        const url = mediaStreamUrl(media.path);
        if (el.dataset.path !== media.path) {
          el.dataset.path = media.path;
          el.src = url;
        }
        const sourceTime = timelineToSourceTime(clip, playheadTicks);
        if (sourceTime === null) continue;
        const want = ticksToSeconds(sourceTime);
        if (Math.abs(el.currentTime - want) > 0.25) {
          el.currentTime = want;
        }
        if (playing && el.paused) void el.play().catch(() => undefined);
        if (!playing && !el.paused) el.pause();
      }

      setVuLevels(levels);
      raf = requestAnimationFrame(pump);
    };
    raf = requestAnimationFrame(pump);

    return () => {
      cancelAnimationFrame(raf);
      for (const el of elementsRef.current.values()) {
        el.pause();
        el.src = "";
      }
      void ctx.close();
    };
  }, []);
}

import { useMemo, useState } from "react";
import {
  createLowerThird,
  createTitle,
  sampleTitleAnimation,
  secondsToTicks,
  serializeSrt,
  parseSrt,
} from "@lumina/core";
import { createTranscriptionJob, runDemoTranscription, transcriptionToCues } from "@lumina/ai";
import { useEditorStore } from "../../store/editor-store";
import { requestTranscription, isFileBacked } from "../../lib/media-api";

export function TitlesPanel() {
  const [text, setText] = useState("Lumina");
  const [animT, setAnimT] = useState(0.5);
  const [captions, setCaptions] = useState<string>("");
  const [sttStatus, setSttStatus] = useState("");
  const project = useEditorStore((s) => s.project);
  const setTitleOverlay = useEditorStore((s) => s.setTitleOverlay);
  const importSrtText = useEditorStore((s) => s.importSrtText);
  const exportSrtPreview = useEditorStore((s) => s.exportSrtPreview);
  const subtitleCues = useEditorStore((s) => s.subtitleCues);
  const title = useMemo(() => {
    const doc = createTitle(text, "Hero Title");
    return { ...doc, animation: "typewriter" as const };
  }, [text]);
  const sample = sampleTitleAnimation(title, secondsToTicks(animT));
  const lower = createLowerThird("Alex Editor", "Lead Cut");

  const demoCaptions = useMemo(() => {
    const job = runDemoTranscription(createTranscriptionJob("demo://color-bars"));
    const cues = transcriptionToCues(job);
    return serializeSrt(cues);
  }, []);

  const media = project.media.find((m) => isFileBacked(m.path) && m.metadata.hasAudio);
  const srtBody = captions || demoCaptions;

  return (
    <section className="lum-panel flex flex-col min-h-0">
      <header className="px-2 py-1.5 border-b border-line text-sm font-medium">
        Titles / Captions
      </header>
      <div className="flex-1 overflow-auto lum-scroll p-3 space-y-3 text-sm">
        <label className="block space-y-1">
          <span className="text-xs text-muted">Title text</span>
          <input
            className="w-full bg-transparent border border-line px-2 py-1"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setTitleOverlay(e.target.value || null);
            }}
          />
        </label>
        <div className="flex gap-2">
          <button type="button" className="lum-btn-primary" onClick={() => setTitleOverlay(text)}>
            Show on Program
          </button>
          <button type="button" className="lum-btn" onClick={() => setTitleOverlay(null)}>
            Clear overlay
          </button>
        </div>
        <label className="grid grid-cols-[1fr_40px] gap-2 items-center text-xs">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={animT}
            onChange={(e) => setAnimT(Number(e.target.value))}
          />
          <span className="font-mono">{animT.toFixed(2)}</span>
        </label>
        <div className="border border-line bg-black/40 p-4 min-h-[88px] flex items-center justify-center">
          <div
            className="font-display text-2xl text-center"
            style={{ opacity: sample.opacity, transform: `translateY(${sample.offsetY}px)` }}
          >
            {sample.text || " "}
          </div>
        </div>
        <div className="text-xs text-muted">Lower third preset: {lower.name}</div>

        <button
          type="button"
          className="lum-btn-primary"
          disabled={!media}
          onClick={() => {
            if (!media) return;
            setSttStatus("Transcribing…");
            void requestTranscription(media.path).then((job) => {
              setCaptions(job.resultSrt ?? "");
              setSttStatus(
                job.error
                  ? `Fallback/demo (${job.provider}): ${job.error}`
                  : `OK via ${job.provider}`,
              );
            });
          }}
        >
          Speech-to-text {media ? `(${media.name})` : "(no audio media)"}
        </button>
        {sttStatus && <div className="text-[11px] text-muted">{sttStatus}</div>}

        <div className="text-xs whitespace-pre-wrap font-mono border border-line p-2 max-h-40 overflow-auto">
          {srtBody}
        </div>
        <div className="text-[11px] text-muted">
          Parsed cues: {parseSrt(srtBody).length}
          {subtitleCues.length ? ` · on timeline: ${subtitleCues.length}` : ""}
        </div>
        <div className="flex flex-wrap gap-1">
          <button type="button" className="lum-btn-primary" onClick={() => importSrtText(srtBody)}>
            Place on subtitle track
          </button>
          <label className="lum-btn cursor-pointer">
            Import SRT/VTT
            <input
              type="file"
              accept=".srt,.vtt,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void file.text().then((t) => {
                  setCaptions(t);
                  importSrtText(t);
                });
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="lum-btn"
            onClick={() => {
              const out = exportSrtPreview();
              setCaptions(out);
              void navigator.clipboard?.writeText(out);
            }}
          >
            Export SRT
          </button>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useRef } from "react";
import { fetchPeaks, isFileBacked } from "../../lib/media-api";

export function Waveform({
  mediaPath,
  width,
  height,
}: {
  mediaPath: string;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const canvas = canvasRef.current;
      if (!canvas || width < 4) return;
      canvas.width = Math.floor(width);
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      if (!isFileBacked(mediaPath)) {
        // synthetic sine preview
        for (let x = 0; x < canvas.width; x += 1) {
          const a = Math.sin(x / 8) * 0.4 + 0.5;
          const h = a * height;
          ctx.fillRect(x, (height - h) / 2, 1, h);
        }
        return;
      }
      const peaks = await fetchPeaks(mediaPath, Math.min(512, Math.floor(width)));
      if (cancelled || !peaks) return;
      ctx.fillStyle = "rgba(180,255,210,0.55)";
      const buckets = peaks.length / 2;
      for (let i = 0; i < buckets; i += 1) {
        const min = peaks[i * 2]!;
        const max = peaks[i * 2 + 1]!;
        const x = (i / buckets) * canvas.width;
        const y1 = ((1 - max) / 2) * height;
        const y2 = ((1 - min) / 2) * height;
        ctx.fillRect(x, y1, Math.max(1, canvas.width / buckets), Math.max(1, y2 - y1));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [mediaPath, width, height]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

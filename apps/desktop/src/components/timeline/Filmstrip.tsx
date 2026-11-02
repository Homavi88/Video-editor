import { useEffect, useState } from "react";
import { requestFilmstrip, isFileBacked } from "../../lib/media-api";

export function Filmstrip({
  mediaPath,
  durationSeconds,
  inPointSeconds = 0,
}: {
  mediaPath: string;
  durationSeconds: number;
  inPointSeconds?: number;
}) {
  const [frames, setFrames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!isFileBacked(mediaPath) || durationSeconds <= 0) {
      setFrames([]);
      return;
    }
    void requestFilmstrip(mediaPath, durationSeconds, inPointSeconds).then((urls) => {
      if (!cancelled) setFrames(urls);
    });
    return () => {
      cancelled = true;
    };
  }, [mediaPath, durationSeconds, inPointSeconds]);

  if (frames.length === 0) return null;
  return (
    <div className="absolute inset-0 flex pointer-events-none opacity-70">
      {frames.map((src, i) => (
        <img
          key={`${i}-${src.slice(0, 32)}`}
          src={src}
          alt=""
          className="h-full flex-1 object-cover min-w-0"
          draggable={false}
        />
      ))}
    </div>
  );
}

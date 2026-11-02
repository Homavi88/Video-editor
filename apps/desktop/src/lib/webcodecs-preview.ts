/**
 * Continuous preview bridge: HTML media element + optional VideoFrame (WebCodecs).
 * Used while the transport is playing; scrubbing still uses ffmpeg frame cache.
 */

export type FrameSink = (bitmap: ImageBitmap | HTMLVideoElement) => void;

export class ContinuousPreview {
  private readonly video = document.createElement("video");
  private sink: FrameSink | null = null;
  private rvfcHandle = 0;
  private path: string | null = null;
  private running = false;

  constructor() {
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.preload = "auto";
    this.video.crossOrigin = "anonymous";
  }

  get element(): HTMLVideoElement {
    return this.video;
  }

  async setSource(streamUrl: string, pathKey: string): Promise<void> {
    if (this.path === pathKey && this.video.src) return;
    this.path = pathKey;
    this.video.src = streamUrl;
    await this.video.play().catch(() => undefined);
    this.video.pause();
  }

  async seek(seconds: number): Promise<void> {
    if (!Number.isFinite(seconds)) return;
    const t = Math.max(0, seconds);
    if (Math.abs(this.video.currentTime - t) < 0.04) return;
    this.video.currentTime = t;
    if (this.video.seeking) {
      await new Promise<void>((resolve) => {
        const done = () => {
          this.video.removeEventListener("seeked", done);
          resolve();
        };
        this.video.addEventListener("seeked", done);
      });
    }
  }

  start(sink: FrameSink): void {
    this.sink = sink;
    this.running = true;
    void this.video.play().catch(() => undefined);
    const tick = async () => {
      if (!this.running) return;
      try {
        if ("requestVideoFrameCallback" in this.video) {
          this.rvfcHandle = (
            this.video as HTMLVideoElement & {
              requestVideoFrameCallback: (cb: () => void) => number;
            }
          ).requestVideoFrameCallback(() => {
            void this.emitFrame().then(() => tick());
          });
        } else {
          await this.emitFrame();
          requestAnimationFrame(() => void tick());
        }
      } catch {
        requestAnimationFrame(() => void tick());
      }
    };
    void tick();
  }

  stop(): void {
    this.running = false;
    this.video.pause();
    if (
      this.rvfcHandle &&
      "cancelVideoFrameCallback" in this.video
    ) {
      (
        this.video as HTMLVideoElement & {
          cancelVideoFrameCallback: (h: number) => void;
        }
      ).cancelVideoFrameCallback(this.rvfcHandle);
    }
    this.rvfcHandle = 0;
  }

  currentTime(): number {
    return this.video.currentTime || 0;
  }

  private async emitFrame(): Promise<void> {
    if (!this.sink || this.video.readyState < 2) return;
    // Prefer VideoFrame (WebCodecs) when available for GPU-friendly handoff.
    if (typeof VideoFrame !== "undefined") {
      try {
        const frame = new VideoFrame(this.video);
        const bitmap = await createImageBitmap(frame);
        frame.close();
        this.sink(bitmap);
        return;
      } catch {
        // fall through
      }
    }
    this.sink(this.video);
  }
}

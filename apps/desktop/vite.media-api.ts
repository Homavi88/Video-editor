/**
 * Vite middleware: local media API for probe/frame/export/demo/proxy/peaks.
 * Paths are constrained by {@link assertAllowedPath}.
 */
import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";
import {
  probeFile,
  extractFramePng,
  generateDemoMedia,
  exportSequence,
  buildSequenceExportCommand,
  assertAllowedPath,
  defaultAllowedRoots,
  generateProxyFile,
  extractPeaks,
  generateFilmstrip,
  detectEncoders,
} from "@lumina/media-client";
import { transcribeWithWhisper } from "@lumina/ai/whisper";

const CACHE = path.resolve(".lumina-cache");
const ROOTS = defaultAllowedRoots([CACHE, path.resolve("apps/desktop/.lumina-cache")]);

export function luminaMediaApi(): Plugin {
  return {
    name: "lumina-media-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (!req.url?.startsWith("/api/")) return next();
          const url = new URL(req.url, "http://127.0.0.1");

          if (url.pathname === "/api/health") {
            json(res, { ok: true, roots: ROOTS.length });
            return;
          }

          if (url.pathname === "/api/encoders") {
            json(res, { encoders: await detectEncoders() });
            return;
          }

          if (url.pathname === "/api/demo/ensure" && req.method === "POST") {
            const demo = await generateDemoMedia(path.join(CACHE, "demo"));
            json(res, demo);
            return;
          }

          if (url.pathname === "/api/probe") {
            const filePath = assertAllowedPath(need(url, "path"), ROOTS);
            const result = await probeFile(filePath);
            json(res, {
              kind: result.kind,
              metadata: {
                ...result.metadata,
                duration: result.metadata.duration.toString(),
              },
            });
            return;
          }

          if (url.pathname === "/api/frame") {
            const filePath = assertAllowedPath(need(url, "path"), ROOTS);
            const t = Number(url.searchParams.get("t") ?? "0");
            const w = Number(url.searchParams.get("w") ?? "960");
            const h = Number(url.searchParams.get("h") ?? "540");
            if (!fs.existsSync(filePath)) return bad(res, "file not found", 404);
            const png = await extractFramePng(filePath, {
              timeSeconds: t,
              width: w,
              height: h,
            });
            res.statusCode = 200;
            res.setHeader("Content-Type", "image/png");
            res.setHeader("Cache-Control", "no-store");
            res.end(png);
            return;
          }

          // Range-capable media stream for HTMLVideoElement / Web Audio / WebCodecs.
          if (url.pathname === "/api/stream") {
            const filePath = assertAllowedPath(need(url, "path"), ROOTS);
            if (!fs.existsSync(filePath)) return bad(res, "file not found", 404);
            const stat = fs.statSync(filePath);
            const mime = mimeFor(filePath);
            const range = req.headers.range;
            res.setHeader("Accept-Ranges", "bytes");
            res.setHeader("Content-Type", mime);
            res.setHeader("Cache-Control", "private, max-age=60");
            if (range) {
              const m = /^bytes=(\d*)-(\d*)$/.exec(range);
              if (!m) return bad(res, "invalid range", 416);
              const start = m[1] ? Number(m[1]) : 0;
              const end = m[2] ? Number(m[2]) : stat.size - 1;
              if (start >= stat.size || end >= stat.size || start > end) {
                res.statusCode = 416;
                res.setHeader("Content-Range", `bytes */${stat.size}`);
                res.end();
                return;
              }
              res.statusCode = 206;
              res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
              res.setHeader("Content-Length", String(end - start + 1));
              fs.createReadStream(filePath, { start, end }).pipe(res);
            } else {
              res.statusCode = 200;
              res.setHeader("Content-Length", String(stat.size));
              fs.createReadStream(filePath).pipe(res);
            }
            return;
          }

          if (url.pathname === "/api/proxy" && req.method === "POST") {
            const body = JSON.parse(await readBody(req)) as { path: string };
            const filePath = assertAllowedPath(body.path, ROOTS);
            const out = path.join(
              CACHE,
              "proxy",
              `${path.basename(filePath, path.extname(filePath))}.proxy.mp4`,
            );
            await generateProxyFile(filePath, out);
            json(res, { proxyPath: out, width: 1280 });
            return;
          }

          if (url.pathname === "/api/peaks") {
            const filePath = assertAllowedPath(need(url, "path"), ROOTS);
            const buckets = Number(url.searchParams.get("buckets") ?? "512");
            const peaks = await extractPeaks(filePath, { buckets });
            json(res, {
              buckets: peaks.buckets,
              sampleRate: peaks.sampleRate,
              peaks: Array.from(peaks.peaks),
            });
            return;
          }

          if (url.pathname === "/api/filmstrip") {
            const filePath = assertAllowedPath(need(url, "path"), ROOTS);
            const duration = Number(url.searchParams.get("duration") ?? "8");
            const start = Number(url.searchParams.get("start") ?? "0");
            const frames = Number(url.searchParams.get("frames") ?? "8");
            const files = await generateFilmstrip(filePath, path.join(CACHE, "filmstrip"), {
              durationSeconds: duration,
              startSeconds: start,
              frames,
            });
            const dataUrls = files.map(
              (f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`,
            );
            json(res, {
              frames: dataUrls,
              paths: files,
            });
            return;
          }

          if (url.pathname === "/api/watch/scan") {
            const dir = assertAllowedPath(need(url, "dir"), ROOTS);
            if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
              return bad(res, "not a directory", 400);
            }
            const files: string[] = [];
            const walk = (d: string, depth: number) => {
              if (depth > 3) return;
              for (const name of fs.readdirSync(d)) {
                if (name.startsWith(".")) continue;
                const full = path.join(d, name);
                let st: fs.Stats;
                try {
                  st = fs.statSync(full);
                } catch {
                  continue;
                }
                if (st.isDirectory()) walk(full, depth + 1);
                else if (/\.(mp4|mov|mkv|avi|webm|mxf|mp3|wav|aac|flac|m4a|png|jpe?g|webp|gif)$/i.test(name)) {
                  files.push(full);
                }
              }
            };
            walk(dir, 0);
            json(res, { dir, files: files.slice(0, 500) });
            return;
          }

          if (url.pathname === "/api/transcribe" && req.method === "POST") {
            const body = JSON.parse(await readBody(req)) as { path: string; language?: string };
            const filePath = assertAllowedPath(body.path, ROOTS);
            const job = await transcribeWithWhisper(filePath, {
              language: body.language ?? "auto",
              workDir: path.join(CACHE, "whisper"),
            });
            json(res, job);
            return;
          }

          if (url.pathname === "/api/export" && req.method === "POST") {
            const body = await readBody(req);
            const payload = JSON.parse(body) as {
              sequence: Parameters<typeof exportSequence>[0]["sequence"];
              media: Parameters<typeof exportSequence>[0]["media"];
              outputPath: string;
              dryRun?: boolean;
              mode?: "concat" | "overlay";
              preferredFadeSeconds?: number;
              width?: number;
              height?: number;
              fps?: number;
              crf?: number;
              videoCodec?: string;
              audioCodec?: string;
            };
            payload.outputPath = assertAllowedPath(payload.outputPath, ROOTS);
            const revived = reviveProjectBits(payload);
            const withMode = {
              ...revived,
              mode: payload.mode,
              preferredFadeSeconds: payload.preferredFadeSeconds,
              width: payload.width,
              height: payload.height,
              fps: payload.fps,
              crf: payload.crf,
              videoCodec: payload.videoCodec,
              audioCodec: payload.audioCodec,
            };
            if (payload.dryRun) {
              const cmd = buildSequenceExportCommand(withMode);
              json(res, {
                ok: true,
                args: cmd.args,
                description: cmd.description,
                encoder: cmd.encoder,
              });
              return;
            }
            const result = await exportSequence(withMode);
            json(res, {
              ok: true,
              outputPath: payload.outputPath,
              encoder: result.encoder,
              description: result.description,
            });
            return;
          }

          next();
        } catch (err) {
          bad(res, err instanceof Error ? err.message : String(err), 500);
        }
      });
    },
  };
}

function need(url: URL, key: string): string {
  const v = url.searchParams.get(key);
  if (!v) throw new Error(`${key} required`);
  return v;
}

function mimeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  };
  return map[ext] ?? "application/octet-stream";
}

function json(res: import("http").ServerResponse, data: unknown): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

function bad(res: import("http").ServerResponse, message: string, code = 400): void {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: message }));
}

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function reviveProjectBits<T extends { sequence: unknown; media: unknown; outputPath: string }>(
  payload: T,
): Parameters<typeof exportSequence>[0] {
  const raw = JSON.stringify(payload);
  const parsed = JSON.parse(raw, (key, value) => {
    if (
      typeof value === "string" &&
      /^(start|duration|inPoint|outPoint|time)$/.test(key) &&
      /^-?\d+$/.test(value)
    ) {
      return BigInt(value);
    }
    return value;
  }) as typeof payload;
  return {
    sequence: parsed.sequence as Parameters<typeof exportSequence>[0]["sequence"],
    media: parsed.media as Parameters<typeof exportSequence>[0]["media"],
    outputPath: parsed.outputPath,
  };
}

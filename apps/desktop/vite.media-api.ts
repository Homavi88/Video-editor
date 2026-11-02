/**
 * Vite middleware: local media API for probe/frame/export/demo generation.
 * Enables real ffmpeg-backed preview while running `npm run dev` without Electron.
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
} from "@lumina/media-client";

const CACHE = path.resolve(".lumina-cache");

export function luminaMediaApi(): Plugin {
  return {
    name: "lumina-media-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (!req.url?.startsWith("/api/")) return next();
          const url = new URL(req.url, "http://127.0.0.1");

          if (url.pathname === "/api/health") {
            json(res, { ok: true });
            return;
          }

          if (url.pathname === "/api/demo/ensure" && req.method === "POST") {
            const demo = await generateDemoMedia(path.join(CACHE, "demo"));
            json(res, demo);
            return;
          }

          if (url.pathname === "/api/probe") {
            const filePath = url.searchParams.get("path");
            if (!filePath) return bad(res, "path required");
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
            const filePath = url.searchParams.get("path");
            const t = Number(url.searchParams.get("t") ?? "0");
            const w = Number(url.searchParams.get("w") ?? "960");
            const h = Number(url.searchParams.get("h") ?? "540");
            if (!filePath) return bad(res, "path required");
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

          if (url.pathname === "/api/export" && req.method === "POST") {
            const body = await readBody(req);
            const payload = JSON.parse(body) as {
              sequence: Parameters<typeof exportSequence>[0]["sequence"];
              media: Parameters<typeof exportSequence>[0]["media"];
              outputPath: string;
              dryRun?: boolean;
            };
            // Revive bigint fields that arrived as strings
            const revived = reviveProjectBits(payload);
            if (payload.dryRun) {
              const cmd = buildSequenceExportCommand(revived);
              json(res, { ok: true, args: cmd.args, description: cmd.description });
              return;
            }
            await exportSequence(revived);
            json(res, { ok: true, outputPath: payload.outputPath });
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
    if (key === "duration" && typeof value === "string" && /^-?\d+$/.test(value)) {
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

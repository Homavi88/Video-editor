#!/usr/bin/env node
/**
 * Smoke e2e against a running Vite server (npm run dev).
 * Checks health, demo media generation, probe, and frame extract.
 */
const base = process.env.LUMINA_URL || "http://127.0.0.1:5173";

async function main() {
  const health = await fetch(`${base}/api/health`);
  if (!health.ok) throw new Error("health failed");
  const demoRes = await fetch(`${base}/api/demo/ensure`, { method: "POST" });
  if (!demoRes.ok) throw new Error(`demo ensure failed: ${await demoRes.text()}`);
  const demo = await demoRes.json();
  const probe = await fetch(`${base}/api/probe?path=${encodeURIComponent(demo.video)}`);
  if (!probe.ok) throw new Error("probe failed");
  const frame = await fetch(
    `${base}/api/frame?path=${encodeURIComponent(demo.video)}&t=0.5&w=320&h=180`,
  );
  if (!frame.ok) throw new Error("frame failed");
  const buf = Buffer.from(await frame.arrayBuffer());
  if (buf.length < 100 || buf[0] !== 0x89) throw new Error("frame is not PNG");

  const enc = await fetch(`${base}/api/encoders`);
  if (!enc.ok) throw new Error("encoders failed");
  const peaks = await fetch(
    `${base}/api/peaks?path=${encodeURIComponent(demo.audio)}&buckets=64`,
  );
  if (!peaks.ok) throw new Error("peaks failed");
  const denied = await fetch(`${base}/api/probe?path=${encodeURIComponent("/etc/passwd")}`);
  if (denied.status !== 500 && denied.status !== 400) {
    throw new Error("path guard should reject /etc/passwd");
  }
  const stream = await fetch(`${base}/api/stream?path=${encodeURIComponent(demo.video)}`, {
    headers: { Range: "bytes=0-1023" },
  });
  if (stream.status !== 206 && stream.status !== 200) {
    throw new Error(`stream failed: ${stream.status}`);
  }
  console.log("e2e-smoke OK", {
    video: demo.video,
    pngBytes: buf.length,
    encoders: (await enc.json()).encoders?.length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

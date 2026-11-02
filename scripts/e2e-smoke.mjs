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
  console.log("e2e-smoke OK", { video: demo.video, pngBytes: buf.length });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

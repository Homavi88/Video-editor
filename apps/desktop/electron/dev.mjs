import { spawn } from "node:child_process";
import electron from "electron";

const vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", "5173"], {
  stdio: "inherit",
  shell: true,
});

await new Promise((r) => setTimeout(r, 1500));

const child = spawn(electron, ["."], {
  stdio: "inherit",
  env: { ...process.env, LUMINA_DEV_URL: "http://127.0.0.1:5173" },
});

child.on("close", (code) => {
  vite.kill();
  process.exit(code ?? 0);
});

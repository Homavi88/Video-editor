import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { luminaMediaApi } from "./vite.media-api";

export default defineConfig({
  plugins: [react(), luminaMediaApi()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});

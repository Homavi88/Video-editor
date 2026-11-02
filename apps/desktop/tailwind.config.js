/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: "var(--lum-canvas)",
        panel: "var(--lum-panel)",
        ink: "var(--lum-ink)",
        muted: "var(--lum-muted)",
        line: "var(--lum-line)",
        accent: "var(--lum-accent)",
        accent2: "var(--lum-accent-2)",
        danger: "var(--lum-danger)",
        clip: "var(--lum-clip)",
        audio: "var(--lum-audio)",
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"IBM Plex Sans"', "Segoe UI", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "none",
      },
    },
  },
  plugins: [],
};

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        "pulse-danger": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-danger":  "glowDanger 2s ease-in-out infinite alternate",
        "subtle-pulse": "subtlePulse 2s ease-in-out infinite",
      },
      keyframes: {
        glowDanger: {
          from: { boxShadow: "0 0 6px rgba(220, 38, 38, 0.25)" },
          to:   { boxShadow: "0 0 18px rgba(220, 38, 38, 0.35)" },
        },
        subtlePulse: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.75" },
        },
      },
      colors: {
        danger:  "var(--color-danger)",
        primary: "var(--color-primary)",
        accent:  "var(--color-accent)",
      },
    },
  },
  plugins: [],
};

export default config;

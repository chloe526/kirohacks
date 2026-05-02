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
        "pulse-danger": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-danger": "glowDanger 1.5s ease-in-out infinite alternate",
      },
      keyframes: {
        glowDanger: {
          from: { boxShadow: "0 0 8px rgba(239, 68, 68, 0.4)" },
          to: { boxShadow: "0 0 24px rgba(239, 68, 68, 0.4)" },
        },
      },
      colors: {
        danger: "var(--color-danger)",
        primary: "var(--color-primary)",
        accent: "var(--color-accent)",
      },
    },
  },
  plugins: [],
};

export default config;

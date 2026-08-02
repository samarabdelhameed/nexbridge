import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07080f",
          900: "#0b0d18",
          850: "#101321",
          800: "#161a2e",
          700: "#222741",
          600: "#2f3557",
        },
        neon: {
          DEFAULT: "#7c5cff",
          soft: "#9f8aff",
          glow: "#b18cff",
        },
        mint: "#3ef2c2",
        coral: "#ff6b8b",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        neon: "0 0 24px rgba(124, 92, 255, 0.35)",
        card: "0 8px 40px rgba(0, 0, 0, 0.35)",
      },
      animation: {
        "pulse-slow": "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

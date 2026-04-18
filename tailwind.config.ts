import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        crowd: {
          clear: "#16a34a",
          moderate: "#eab308",
          busy: "#f97316",
          packed: "#dc2626",
          unknown: "#6b7280",
        },
      },
    },
  },
  plugins: [],
};

export default config;

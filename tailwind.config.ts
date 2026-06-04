import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0b0f",
          900: "#12131a",
          800: "#1a1b26",
          700: "#2a2c3a",
        },
        neon: {
          500: "#4af2c8",
          400: "#66ffe0",
        },
        tide: {
          500: "#3aa6ff",
          400: "#6ac1ff",
        },
        sand: {
          50: "#f7f4ef",
          100: "#efe8dd",
          200: "#e3d6c2",
        },
      },
      boxShadow: {
        glow: "0 0 30px rgba(74, 242, 200, 0.25)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;

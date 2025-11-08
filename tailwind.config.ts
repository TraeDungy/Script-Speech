import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        "vs-background": "#020617",
        "vs-panel": "rgba(15, 23, 42, 0.6)",
        "vs-accent": "#38bdf8",
        "vs-accent-strong": "#818cf8"
      },
      backdropBlur: {
        xs: "2px"
      },
      boxShadow: {
        glass: "0 20px 45px -25px rgba(56, 189, 248, 0.45)",
        glow: "0 0 50px rgba(129, 140, 248, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;

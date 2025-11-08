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
        "vs-background": "#050505",
        "vs-panel": "rgba(24, 24, 27, 0.85)",
        "vs-accent": "#f5f5f5",
        "vs-accent-strong": "#d4d4d8"
      },
      backdropBlur: {
        xs: "2px"
      },
      boxShadow: {
        glass: "0 24px 60px -30px rgba(250, 250, 250, 0.12)",
        glow: "0 0 60px rgba(212, 212, 216, 0.2)"
      }
    }
  },
  plugins: []
};

export default config;

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // v0.9 §3.5 컬러 팔레트
        primary: { DEFAULT: "#4ECDC4" },
        success: { DEFAULT: "#10B981" },
        warning: { DEFAULT: "#FCD34D" },
        error: { DEFAULT: "#FB7185" },
        ink: { DEFAULT: "#1F2937" },
        subtle: { DEFAULT: "#6B7280" },
        bg: { DEFAULT: "#FAFAFA" },
        surface: { DEFAULT: "#FFFFFF" },
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "Inter Variable",
          "system-ui",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        base: ["16px", "1.6"],
      },
    },
  },
  plugins: [],
};

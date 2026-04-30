// v0.9 §3.5 디자인 토큰. 코드에서 직접 참조할 때 단일 출처.
export const tokens = {
  color: {
    primary: "#4ECDC4",
    success: "#10B981",
    warning: "#FCD34D",
    error: "#FB7185",
    ink: "#1F2937",
    subtle: "#6B7280",
    bg: "#FAFAFA",
    surface: "#FFFFFF",
  },
  radius: {
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
  },
  motion: {
    quick: 200,
    base: 300,
    slow: 400,
  },
} as const;

export type ColorToken = keyof typeof tokens.color;

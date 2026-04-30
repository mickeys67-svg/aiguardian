import { create } from "zustand";

export type OnboardingStage =
  | "welcome"
  | "diagnosis"
  | "result"
  | "goal"
  | "recipe"
  | "confirm";

interface OnboardingState {
  stage: OnboardingStage;
  setStage: (s: OnboardingStage) => void;
  next: () => void;
}

const ORDER: OnboardingStage[] = [
  "welcome",
  "diagnosis",
  "result",
  "goal",
  "recipe",
  "confirm",
];

export const useOnboarding = create<OnboardingState>((set, get) => ({
  stage: "welcome",
  setStage: (stage) => set({ stage }),
  next: () => {
    const idx = ORDER.indexOf(get().stage);
    if (idx >= 0 && idx < ORDER.length - 1) {
      const nextStage = ORDER[idx + 1];
      if (nextStage) set({ stage: nextStage });
    }
  },
}));

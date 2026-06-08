import { create } from "zustand";

export type OnboardingStage =
  | "welcome"
  | "diagnosis"
  | "result"
  | "goal"
  | "recipe"
  | "confirm";

export type AppMode = "onboarding" | "main";

export type MainSection = "coach" | "home" | "recipes" | "projects" | "learn" | "settings";

interface AppState {
  mode: AppMode;
  stage: OnboardingStage;
  section: MainSection;
  selectedRecipeId: string | null;

  setStage: (s: OnboardingStage) => void;
  next: () => void;
  finishOnboarding: () => void;
  setSection: (s: MainSection) => void;
  selectRecipe: (id: string | null) => void;
}

const ORDER: OnboardingStage[] = [
  "welcome",
  "diagnosis",
  "result",
  "goal",
  "recipe",
  "confirm",
];

const STORAGE_KEY = "tg.app.mode";

const initialMode: AppMode =
  (localStorage.getItem(STORAGE_KEY) as AppMode | null) ?? "onboarding";

export const useApp = create<AppState>((set, get) => ({
  mode: initialMode,
  stage: "welcome",
  section: "home",
  selectedRecipeId: null,

  setStage: (stage) => set({ stage }),
  next: () => {
    const idx = ORDER.indexOf(get().stage);
    if (idx >= 0 && idx < ORDER.length - 1) {
      const nextStage = ORDER[idx + 1];
      if (nextStage) set({ stage: nextStage });
    }
  },
  finishOnboarding: () => {
    localStorage.setItem(STORAGE_KEY, "main");
    set({ mode: "main", section: "home" });
  },
  setSection: (section) => set({ section }),
  selectRecipe: (id) => set({ selectedRecipeId: id }),
}));

/** 호환용 별칭 — 기존 코드가 useOnboarding 으로 import. */
export const useOnboarding = useApp;

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

// 기본 진입 = 메인(코치). 코치가 우리 현관이라, 옛 온보딩 마법사 뒤에 숨기지 않는다.
// (ADR-0004 "아무나 쉽게". 마법사는 추후 은퇴 대상.)
const initialMode: AppMode =
  (localStorage.getItem(STORAGE_KEY) as AppMode | null) ?? "main";

export const useApp = create<AppState>((set, get) => ({
  mode: initialMode,
  stage: "welcome",
  section: "coach",
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
    set({ mode: "main", section: "coach" });
  },
  setSection: (section) => set({ section }),
  selectRecipe: (id) => set({ selectedRecipeId: id }),
}));

/** 호환용 별칭 — 기존 코드가 useOnboarding 으로 import. */
export const useOnboarding = useApp;

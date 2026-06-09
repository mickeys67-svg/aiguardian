import { create } from "zustand";

// 코치가 앱의 현관이자 전부다. 옛 온보딩 마법사(mode/stage)는 제거됨 — 코치 외 진입 없음.
export type MainSection = "coach" | "home" | "recipes" | "projects" | "learn" | "settings";

interface AppState {
  section: MainSection;
  selectedRecipeId: string | null;
  setSection: (s: MainSection) => void;
  selectRecipe: (id: string | null) => void;
}

export const useApp = create<AppState>((set) => ({
  section: "coach",
  selectedRecipeId: null,
  setSection: (section) => set({ section }),
  selectRecipe: (id) => set({ selectedRecipeId: id }),
}));

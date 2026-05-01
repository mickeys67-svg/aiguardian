import { create } from "zustand";
import {
  addProject,
  setProjectArtifact as persistArtifact,
  removeProject,
  type ProjectRecord,
} from "@/lib/projects";

export type OnboardingStage =
  | "welcome"
  | "diagnosis"
  | "result"
  | "goal"
  | "recipe"
  | "confirm"
  | "aibridge"
  | "artifact";

export type AppMode = "onboarding" | "main";

export type MainSection = "home" | "recipes" | "projects" | "learn" | "settings";

export type RunFlow = {
  recipeId: string;
  /** 사용자에게 보일 라벨 — projects.label 과 같은 값. */
  label?: string;
  startedAt: string;
  artifactPath?: string;
  /** 이 실행이 만든 projects.v1 레코드 ID — 한번 만들면 재사용. */
  projectId?: string;
};

interface AppState {
  mode: AppMode;
  stage: OnboardingStage;
  section: MainSection;
  selectedRecipeId: string | null;
  activeRun: RunFlow | null;

  setStage: (s: OnboardingStage) => void;
  next: () => void;
  finishOnboarding: () => void;
  setSection: (s: MainSection) => void;
  selectRecipe: (id: string | null) => void;
  startRun: (recipeId: string, label?: string) => void;
  /**
   * artifact 경로를 저장하면서 동시에 projects 레코드 생성/갱신.
   * atomic 보장 — race 없음.
   */
  setArtifactPath: (path: string, recipeTitle: string) => void;
  enterRecipeFlow: (recipeId: string) => void;
  resetOnboarding: () => void;
  /** 프로젝트 레코드 + 연관 localStorage 키 일괄 정리. */
  removeProjectFully: (projectId: string, artifactPath?: string) => void;
}

const ORDER: OnboardingStage[] = [
  "welcome",
  "diagnosis",
  "result",
  "goal",
  "recipe",
  "confirm",
  "aibridge",
  "artifact",
];

const STORAGE_KEY = "tg.app.mode";

function readInitialMode(): AppMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "main" ? "main" : "onboarding";
  } catch {
    return "onboarding";
  }
}

/** 한 path 에 묶인 모든 lib/iteration · demo file localStorage 키 청소. */
function cleanupPathStorage(path: string) {
  try {
    localStorage.removeItem(`tg.iter.snap.${path}`);
    localStorage.removeItem(`tg.iter.meta.${path}`);
    localStorage.removeItem(`tg.demo.file.${path}`);
    sessionStorage.removeItem(`tg.demo.file.${path}`);
  } catch {
    /* ignore */
  }
}

export const useApp = create<AppState>((set, get) => ({
  mode: readInitialMode(),
  stage: "welcome",
  section: "home",
  selectedRecipeId: null,
  activeRun: null,

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
  startRun: (recipeId, label) =>
    set({
      activeRun: {
        recipeId,
        label,
        startedAt: new Date().toISOString(),
      },
    }),

  setArtifactPath: (path, recipeTitle) => {
    const run = get().activeRun;
    if (!run) {
      // race 안전: activeRun 없는데 setArtifactPath 호출되면 만들어버림.
      set({
        activeRun: {
          recipeId: "unknown",
          startedAt: new Date().toISOString(),
          artifactPath: path,
        },
      });
      return;
    }

    let projectId = run.projectId;
    if (!projectId) {
      // 새 작품 — projects.v1 에 한 번만 추가.
      const rec: ProjectRecord = addProject({
        recipeId: run.recipeId,
        recipeTitle,
        artifactPath: path,
        label: run.label ?? `내 첫 ${recipeTitle}`,
      });
      projectId = rec.id;
    } else {
      // 기존 작품 갱신 (이터레이션 결과로 path 가 바뀐 경우 등).
      persistArtifact(projectId, path);
    }

    set({
      activeRun: { ...run, artifactPath: path, projectId },
    });
  },

  enterRecipeFlow: (recipeId) => {
    localStorage.setItem(STORAGE_KEY, "onboarding");
    set({
      mode: "onboarding",
      stage: "recipe",
      selectedRecipeId: recipeId,
      activeRun: { recipeId, startedAt: new Date().toISOString() },
    });
  },

  resetOnboarding: () => {
    localStorage.setItem(STORAGE_KEY, "onboarding");
    // 활성 작업이 있었다면 그 path 의 임시 데모 파일은 청소.
    const run = get().activeRun;
    if (run?.artifactPath) cleanupPathStorage(run.artifactPath);
    set({
      mode: "onboarding",
      stage: "welcome",
      selectedRecipeId: null,
      activeRun: null,
    });
  },

  removeProjectFully: (projectId, artifactPath) => {
    removeProject(projectId);
    if (artifactPath) cleanupPathStorage(artifactPath);
  },
}));

/** 호환용 별칭 — 기존 코드가 useOnboarding 으로 import. */
export const useOnboarding = useApp;

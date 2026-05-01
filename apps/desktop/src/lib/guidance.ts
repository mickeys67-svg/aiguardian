// 안내 ON/OFF 시스템.
// 3단계 모드 + 세부 토글 + "지금 이 화면만 조용히" + 영구 숨김 코치마크.

import { create } from "zustand";

export type GuidanceMode = "full" | "minimal" | "off";

export type GuidanceFeatures = {
  tooltip: boolean;
  coachmark: boolean;
  hesitation: boolean;
  /** 위험 동작 확인 모달은 끌 수 없음 — 항상 true. */
  confirmModal: true;
  autoAiChat: boolean;
};

interface GuidanceState {
  mode: GuidanceMode;
  features: GuidanceFeatures;
  silencedScreens: string[];
  dismissedCoachmarks: string[];
  experience: { runs: number };

  setMode: (mode: GuidanceMode) => void;
  setFeature: <K extends keyof GuidanceFeatures>(
    key: K,
    value: GuidanceFeatures[K],
  ) => void;
  silenceScreen: (screen: string) => void;
  unsilenceScreen: (screen: string) => void;
  dismissCoachmark: (id: string) => void;
  resetCoachmarks: () => void;
  bumpRun: () => void;

  /** 이 헬퍼를 지금 화면에서 보여줄지 결정. */
  shouldShow: (
    kind: "tooltip" | "coachmark" | "hesitation" | "autoAiChat",
    screenId?: string,
    coachmarkId?: string,
  ) => boolean;
}

const STORAGE_KEY = "tg.guidance.v1";

type Persisted = {
  mode: GuidanceMode;
  features: Omit<GuidanceFeatures, "confirmModal">;
  silencedScreens: string[];
  dismissedCoachmarks: string[];
  experience: { runs: number };
};

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      mode: parsed.mode ?? "full",
      features: {
        tooltip: parsed.features?.tooltip ?? true,
        coachmark: parsed.features?.coachmark ?? true,
        hesitation: parsed.features?.hesitation ?? true,
        autoAiChat: parsed.features?.autoAiChat ?? false,
      },
      silencedScreens: parsed.silencedScreens ?? [],
      dismissedCoachmarks: parsed.dismissedCoachmarks ?? [],
      experience: parsed.experience ?? { runs: 0 },
    };
  } catch {
    return defaults();
  }
}

function defaults(): Persisted {
  return {
    mode: "full",
    features: {
      tooltip: true,
      coachmark: true,
      hesitation: true,
      autoAiChat: false,
    },
    silencedScreens: [],
    dismissedCoachmarks: [],
    experience: { runs: 0 },
  };
}

function persist(state: GuidanceState) {
  const data: Persisted = {
    mode: state.mode,
    features: {
      tooltip: state.features.tooltip,
      coachmark: state.features.coachmark,
      hesitation: state.features.hesitation,
      autoAiChat: state.features.autoAiChat,
    },
    silencedScreens: state.silencedScreens,
    dismissedCoachmarks: state.dismissedCoachmarks,
    experience: state.experience,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* localStorage 가득 찼을 때만 — 무시 */
  }
}

const initial = loadPersisted();

export const useGuidance = create<GuidanceState>((set, get) => ({
  mode: initial.mode,
  features: { ...initial.features, confirmModal: true as const },
  silencedScreens: initial.silencedScreens,
  dismissedCoachmarks: initial.dismissedCoachmarks,
  experience: initial.experience,

  setMode: (mode) => {
    // 모드에 맞춰 features 자동 정렬.
    const features: GuidanceFeatures =
      mode === "full"
        ? {
            tooltip: true,
            coachmark: true,
            hesitation: true,
            confirmModal: true,
            autoAiChat: false,
          }
        : mode === "minimal"
          ? {
              tooltip: true,
              coachmark: false,
              hesitation: false,
              confirmModal: true,
              autoAiChat: false,
            }
          : {
              tooltip: false,
              coachmark: false,
              hesitation: false,
              confirmModal: true,
              autoAiChat: false,
            };
    set({ mode, features });
    persist(get());
  },

  setFeature: (key, value) => {
    if (key === "confirmModal") return; // 끌 수 없음
    set((s) => ({ features: { ...s.features, [key]: value } }));
    persist(get());
  },

  silenceScreen: (screen) => {
    set((s) => ({
      silencedScreens: s.silencedScreens.includes(screen)
        ? s.silencedScreens
        : [...s.silencedScreens, screen],
    }));
    persist(get());
  },

  unsilenceScreen: (screen) => {
    set((s) => ({
      silencedScreens: s.silencedScreens.filter((x) => x !== screen),
    }));
    persist(get());
  },

  dismissCoachmark: (id) => {
    set((s) => ({
      dismissedCoachmarks: s.dismissedCoachmarks.includes(id)
        ? s.dismissedCoachmarks
        : [...s.dismissedCoachmarks, id],
    }));
    persist(get());
  },

  resetCoachmarks: () => {
    set({ dismissedCoachmarks: [], silencedScreens: [] });
    persist(get());
  },

  bumpRun: () => {
    set((s) => ({ experience: { runs: s.experience.runs + 1 } }));
    persist(get());
  },

  shouldShow: (kind, screenId, coachmarkId) => {
    const s = get();
    if (s.mode === "off" && kind !== "autoAiChat") return false;
    if (screenId && s.silencedScreens.includes(screenId)) return false;
    if (kind === "tooltip") return s.features.tooltip;
    if (kind === "hesitation") return s.features.hesitation;
    if (kind === "autoAiChat") return s.features.autoAiChat;
    if (kind === "coachmark") {
      if (!s.features.coachmark) return false;
      if (coachmarkId && s.dismissedCoachmarks.includes(coachmarkId)) return false;
      return true;
    }
    return true;
  },
}));

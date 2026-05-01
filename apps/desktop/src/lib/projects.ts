// 입문자가 만든 프로젝트 기록 — localStorage + 변화 알림.
// 이전엔 listProjects() 가 컴포넌트 마운트 때만 실행돼서 다른 화면에서 추가/삭제가
// 즉시 반영 안 됐음. useSyncExternalStore 로 reactive 화 + cross-tab.

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "tg.projects.v1";
const CHANGE_EVENT = "tg.projects.changed";

export type ProjectRecord = {
  id: string;
  recipeId: string;
  recipeTitle: string;
  createdAt: string;
  artifactPath?: string;
  /** "내 첫 웹페이지" 같이 사용자 친화 라벨 */
  label: string;
};

function load(): ProjectRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ProjectRecord[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(list: ProjectRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    notifyChange();
  } catch {
    /* ignore */
  }
}

/** in-tab change pub/sub. localStorage 의 storage 이벤트는 다른 탭에만 발화하므로
 *  같은 탭의 listener 도 트리거하려면 별도 CustomEvent 필요. */
function notifyChange() {
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* SSR 등 — 무시 */
  }
}

function subscribe(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener(CHANGE_EVENT, handler);
  // 다른 탭의 localStorage 변경.
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
}

// 캐시 안정성: getSnapshot 은 매번 같은 참조를 반환해야 React 가 리렌더 결정 가능.
let cachedSnapshot: ProjectRecord[] = load();
let cachedKey = "";

function readSorted(): ProjectRecord[] {
  return load().sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function getSnapshot(): ProjectRecord[] {
  const sorted = readSorted();
  // 직렬화 문자열을 키로 — 변경 없으면 같은 참조 반환.
  const key = JSON.stringify(sorted.map((p) => `${p.id}:${p.artifactPath ?? ""}`));
  if (key !== cachedKey) {
    cachedSnapshot = sorted;
    cachedKey = key;
  }
  return cachedSnapshot;
}

/** 컴포넌트에서 사용 — 자동으로 변화 시 리렌더. */
export function useProjects(): ProjectRecord[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** 컴포넌트 외부에서 — 단발성 조회. */
export function listProjects(): ProjectRecord[] {
  return readSorted();
}

export function addProject(p: Omit<ProjectRecord, "id" | "createdAt"> & {
  createdAt?: string;
}): ProjectRecord {
  const record: ProjectRecord = {
    id: `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: p.createdAt ?? new Date().toISOString(),
    recipeId: p.recipeId,
    recipeTitle: p.recipeTitle,
    artifactPath: p.artifactPath,
    label: p.label,
  };
  const next = [record, ...load()];
  save(next);
  return record;
}

export function setProjectArtifact(id: string, artifactPath: string) {
  const next = load().map((p) =>
    p.id === id ? { ...p, artifactPath } : p,
  );
  save(next);
}

export function removeProject(id: string) {
  save(load().filter((p) => p.id !== id));
}

/** 인간 친화 시간 ("5분 전"). */
export function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

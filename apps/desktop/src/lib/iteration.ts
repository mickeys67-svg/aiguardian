// 이터레이션 — "한 번 만든 작품을 계속 다듬는" 흐름의 데이터.
// 각 프로젝트마다 버전 스냅샷 (최대 10개) + 현재 활성 버전.
// 자동 저장: 새 코드 적용할 때마다 직전 버전 자동 스냅샷.
// 명시 체크포인트: 사용자가 ⭐ 로 표시.

const SNAP_KEY_PREFIX = "tg.iter.snap.";
const META_KEY_PREFIX = "tg.iter.meta.";
const MAX_SNAPSHOTS = 10;

export type Snapshot = {
  id: string;
  contents: string;
  createdAt: string;
  /** 사용자 메모 — "사진 추가" / "AI에게 분홍색 부탁함" 등 */
  note: string;
  /** ⭐ 체크포인트 (영구 보존) */
  starred: boolean;
};

export type IterationMeta = {
  /** 현재 활성 버전 ID */
  currentId: string | null;
  /** 마지막 AI 요청 (히스토리 누적용) */
  lastPrompt?: string;
  /** 누적 이터레이션 수 — 토큰 절약 안내 임계점 판단용 */
  iterationCount?: number;
  /** 최근 AI 요청들 (최대 10개) */
  recentPrompts?: string[];
  /** 마지막 세션 MD 저장 시점 — 안 저장하고 너무 오래 가면 경고 */
  lastMdSavedAt?: string;
};

/** 세션 변경 권장 임계점 (이 횟수 넘으면 배너 노출). */
export const SESSION_SWITCH_THRESHOLD = 5;

function snapsKey(path: string): string {
  return `${SNAP_KEY_PREFIX}${path}`;
}

function metaKey(path: string): string {
  return `${META_KEY_PREFIX}${path}`;
}

function readSnaps(path: string): Snapshot[] {
  try {
    const raw = localStorage.getItem(snapsKey(path));
    if (!raw) return [];
    const arr = JSON.parse(raw) as Snapshot[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeSnaps(path: string, list: Snapshot[]) {
  try {
    localStorage.setItem(snapsKey(path), JSON.stringify(list));
  } catch {
    /* quota — 가장 오래된 starred=false 항목부터 정리 후 재시도 */
    const reduced = list.filter((s) => s.starred).slice(0, 5);
    try {
      localStorage.setItem(snapsKey(path), JSON.stringify(reduced));
    } catch {
      /* give up */
    }
  }
}

export function readMeta(path: string): IterationMeta {
  try {
    const raw = localStorage.getItem(metaKey(path));
    if (!raw) return { currentId: null };
    return JSON.parse(raw) as IterationMeta;
  } catch {
    return { currentId: null };
  }
}

export function writeMeta(path: string, meta: IterationMeta) {
  try {
    localStorage.setItem(metaKey(path), JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

/** 새 스냅샷 추가. starred=false 인 가장 오래된 것부터 잘라 MAX_SNAPSHOTS 유지.
 *  options.dedupe=true 이고 같은 (note, contents) 가 이미 있으면 추가하지 않고 기존 반환. */
export function addSnapshot(
  path: string,
  contents: string,
  note: string,
  options?: { starred?: boolean; setActive?: boolean; dedupe?: boolean },
): Snapshot {
  const existing = readSnaps(path);

  // 멱등화 — note + contents 동일하면 기존 반환 (StrictMode 더블 마운트 방어).
  if (options?.dedupe) {
    const same = existing.find((s) => s.note === note && s.contents === contents);
    if (same) {
      if (options.setActive === true) {
        writeMeta(path, { ...readMeta(path), currentId: same.id });
      }
      return same;
    }
  }

  const snap: Snapshot = {
    id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    contents,
    createdAt: new Date().toISOString(),
    note,
    starred: !!options?.starred,
  };
  const list = [snap, ...existing];

  // MAX_SNAPSHOTS 초과 시 starred=false 인 가장 오래된 것부터 정리.
  let next = list;
  if (next.length > MAX_SNAPSHOTS) {
    const starred = next.filter((s) => s.starred);
    const unstarred = next.filter((s) => !s.starred);
    const keepUnstarred = unstarred.slice(0, MAX_SNAPSHOTS - starred.length);
    next = [...starred, ...keepUnstarred].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  writeSnaps(path, next);
  // setActive 가 명시 true 일 때만 활성화 (디폴트 비활성으로 변경 — 의도 명확화).
  if (options?.setActive === true) {
    writeMeta(path, { ...readMeta(path), currentId: snap.id });
  }
  return snap;
}

export function listSnapshots(path: string): Snapshot[] {
  return readSnaps(path);
}

export function setActive(path: string, snapshotId: string) {
  writeMeta(path, { ...readMeta(path), currentId: snapshotId });
}

export function getSnapshot(
  path: string,
  snapshotId: string,
): Snapshot | undefined {
  return readSnaps(path).find((s) => s.id === snapshotId);
}

export function toggleStar(path: string, snapshotId: string) {
  const list = readSnaps(path);
  const idx = list.findIndex((s) => s.id === snapshotId);
  if (idx < 0) return;
  const snap = list[idx]!;
  list[idx] = { ...snap, starred: !snap.starred };
  writeSnaps(path, list);
}

export function updateNote(path: string, snapshotId: string, note: string) {
  const list = readSnaps(path);
  const idx = list.findIndex((s) => s.id === snapshotId);
  if (idx < 0) return;
  const snap = list[idx]!;
  list[idx] = { ...snap, note };
  writeSnaps(path, list);
}

export function deleteSnapshot(path: string, snapshotId: string) {
  writeSnaps(
    path,
    readSnaps(path).filter((s) => s.id !== snapshotId),
  );
}

/** 이터레이션 카운트 1 증가 + 최근 prompt 누적 (최대 10). */
export function recordIteration(path: string, prompt: string) {
  const m = readMeta(path);
  const recent = [prompt, ...(m.recentPrompts ?? [])].slice(0, 10);
  writeMeta(path, {
    ...m,
    iterationCount: (m.iterationCount ?? 0) + 1,
    recentPrompts: recent,
  });
}

/** MD 저장 시각 마킹 + 카운트 리셋 (선택). */
export function markMdSaved(path: string, resetCount = false) {
  const m = readMeta(path);
  writeMeta(path, {
    ...m,
    lastMdSavedAt: new Date().toISOString(),
    ...(resetCount ? { iterationCount: 0 } : {}),
  });
}

/**
 * 세션 컨텍스트 MD 생성 — 새 Claude Code 세션에 그대로 붙여넣을 수 있게.
 * v0.9 §4.2 의 핸드오프 패턴.
 */
export function generateSessionMd(args: {
  projectLabel: string;
  recipeId: string;
  path: string;
  contents: string;
}): string {
  const { projectLabel, recipeId, path, contents } = args;
  const meta = readMeta(path);
  const snaps = listSnapshots(path);
  const now = new Date().toLocaleString("ko-KR");

  const recentPrompts = (meta.recentPrompts ?? [])
    .map((p, i) => `${i + 1}. "${p}"`)
    .join("\n") || "(아직 없음)";

  const history = snaps
    .slice()
    .reverse()
    .map((s, i) => {
      const star = s.starred ? "⭐ " : "";
      return `${i + 1}. ${star}${s.note} — ${relativeTime(s.createdAt)}`;
    })
    .join("\n") || "(아직 없음)";

  return `# 🤖 Vibemate 작업 컨텍스트 — 새 Claude 세션에서 이어가기

> 이 문서는 가디언이 자동 생성. **새 Claude Code(또는 Claude.ai) 세션에 첫 메시지로 통째 붙여넣으세요.** 이전 흐름을 바로 이어갈 수 있습니다.

생성 시각: ${now}

---

## 📌 프로젝트 정보
- **작품 이름**: ${projectLabel}
- **레시피 ID**: ${recipeId}
- **파일 경로**: \`${path}\`
- **누적 수정 횟수**: ${meta.iterationCount ?? 0}

## 📜 변경 이력 (오래된 → 최근)
${history}

## 💬 최근 AI 요청들
${recentPrompts}

## 📄 현재 파일 본문 (활성 버전)

\`\`\`html
${contents}
\`\`\`

---

## 🚀 새 세션에서 어떻게 이어가는지 (입문자용)

1. **Claude Code 또는 Claude.ai 에서 새 세션을 시작하세요.**
2. **이 문서 전체를 통째로 첫 메시지로 붙여넣으세요.**
3. 다음 한 줄을 마지막에 추가하세요:
   > "위 컨텍스트를 이어받아 계속 작업하겠습니다. 아래에 새 부탁이 옵니다."
4. **그 다음 줄에 진짜 부탁을 적으세요.** 예: "사진 한 장 더 추가해줘"

이렇게 하면 AI가 이전 흐름을 다 안 채로 작업을 이어갑니다. 토큰도 적게 들고, 답변도 더 정확해요.

---

*가디언이 자동 생성한 컨텍스트 문서 — 안전하게 다른 AI에게도 공유 가능합니다.*
`;
}

/** 인간 친화 시간 ("3분 전"). projects.ts 와 동일 로직. */
export function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

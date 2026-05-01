// 터미널 단축키 치트시트 트리거 — Diagnosis / Confirm / TerminalPane 3곳 공통 로직.
// 이전엔 각자 localStorage 처리 + dismissCount 증가 누락 비대칭이었음.

const SEEN_KEY = "tg.terminal.cheatsheetSeen";
const DISMISS_COUNT_KEY = "tg.terminal.cheatsheetDismissCount";
const NEVER_AGAIN_KEY = "tg.terminal.cheatsheetNeverAgain";
const MAX_DISMISSES = 3;

export function shouldShowCheatsheet(): boolean {
  try {
    if (localStorage.getItem(NEVER_AGAIN_KEY)) return false;
    const seen = !!localStorage.getItem(SEEN_KEY);
    const dismisses = Number(localStorage.getItem(DISMISS_COUNT_KEY) ?? "0");
    return !seen && dismisses < MAX_DISMISSES;
  } catch {
    return false;
  }
}

/** 치트시트 닫음 — 본 적 마킹 + 카운트 증가. 3곳 통일. */
export function markCheatsheetSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
    const cur = Number(localStorage.getItem(DISMISS_COUNT_KEY) ?? "0");
    localStorage.setItem(DISMISS_COUNT_KEY, String(cur + 1));
  } catch {
    /* ignore */
  }
}

/** "이 안내 다시 안 보기" — 사용자가 명시적으로 끔. Settings 에서만 리셋 가능. */
export function dismissCheatsheetForever(): void {
  try {
    localStorage.setItem(NEVER_AGAIN_KEY, "1");
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** 가비지 컬렉터에서 호출 — Settings "데이터 정리" 옵션. */
export function resetCheatsheetState(): void {
  try {
    localStorage.removeItem(SEEN_KEY);
    localStorage.removeItem(DISMISS_COUNT_KEY);
    localStorage.removeItem(NEVER_AGAIN_KEY);
  } catch {
    /* ignore */
  }
}

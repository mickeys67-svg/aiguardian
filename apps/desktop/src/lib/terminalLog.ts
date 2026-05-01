// 항상 떠있는 터미널 패널의 로그 스토어.
// AI 호출, 레시피 명령 실행, 파일 저장, 에러 — 모두 여기로 흘러 들어와 timeline 표시.

import { useSyncExternalStore } from "react";

export type TerminalLineKind =
  | "info"      // 일반 진행 상황
  | "command"   // 실행된 명령 (예: claude -p ...)
  | "stdout"    // 명령 출력
  | "stderr"    // 명령 에러 출력
  | "error"     // 시스템 에러
  | "success"   // 성공
  | "ai";       // AI 답변 라인

export type TerminalLine = {
  id: string;
  kind: TerminalLineKind;
  text: string;
  detail?: string;
  at: string;
};

const MAX_LINES = 500;
const listeners = new Set<() => void>();
let lines: TerminalLine[] = [];

function makeId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function emit() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

export function logTerminal(input: {
  kind: TerminalLineKind;
  text: string;
  detail?: string;
}): TerminalLine {
  const line: TerminalLine = {
    id: makeId(),
    kind: input.kind,
    text: input.text,
    detail: input.detail,
    at: new Date().toISOString(),
  };
  lines = [...lines, line];
  if (lines.length > MAX_LINES) lines = lines.slice(-MAX_LINES);
  emit();
  return line;
}

export function clearTerminal() {
  lines = [];
  emit();
}

export function getTerminalLines(): TerminalLine[] {
  return lines;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): TerminalLine[] {
  return lines;
}

export function useTerminalLines(): TerminalLine[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** 시작 메시지 한 번만 — 모듈 로드 시점. */
if (lines.length === 0) {
  logTerminal({
    kind: "info",
    text: "🛠 가디언 터미널 로그 시작",
    detail: "AI 호출, 명령 실행, 파일 저장 — 모두 여기에 기록됩니다.",
  });
}

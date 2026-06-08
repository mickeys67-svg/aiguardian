// 코칭 코어 — 클라이언트 독립. 정규화된 TurnSummary 를 받아 조언을 만든다.
// 어댑터(claude-code 등)는 이 코어만 의존하면 된다.

import { buildAdvice } from "./advice.ts";
import { renderAdvice } from "./render.ts";
import type { TurnSummary } from "./types.ts";

import { renderAdviceMarkdown } from "./render.ts";

export type { TurnSummary, FileChange, CommandRun } from "./types.ts";
export type { AdviceBucket } from "./advice.ts";
export { buildAdvice } from "./advice.ts";
export { renderAdvice, renderAdviceMarkdown } from "./render.ts";

/**
 * 정규화된 턴 요약 → 사람이 읽을 코칭 텍스트(터미널용).
 * 조언할 내용이 없으면 null (가짜 채움 금지).
 */
export function adviseOnTurn(summary: TurnSummary): string | null {
  const buckets = buildAdvice(summary);
  if (!buckets.length) return null;
  return renderAdvice(buckets);
}

/** 위와 같되 마크다운으로(MCP 도구 응답 등). 조언 없으면 null. */
export function adviseOnTurnMarkdown(summary: TurnSummary): string | null {
  const buckets = buildAdvice(summary);
  if (!buckets.length) return null;
  return renderAdviceMarkdown(buckets);
}

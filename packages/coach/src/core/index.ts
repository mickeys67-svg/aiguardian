// 코칭 코어 — 클라이언트 독립. 정규화된 TurnSummary 를 받아 조언을 만든다.
// 어댑터(claude-code·cursor·mcp)와 HUD 가 모두 이 코어만 의존한다.

import { buildAdvice } from "./advice.ts";
import { renderAdvice } from "./render.ts";
import type { AdviceOptions } from "./advice.ts";
import type { TurnSummary } from "./types.ts";

export type { TurnSummary, FileChange, CommandRun, AdviceBucket, AdviceItem, AdviceKey, CoachState, CoachPhase } from "./types.ts";
export type { Os, AdviceOptions } from "./advice.ts";
export { buildAdvice } from "./advice.ts";
export { renderAdvice, renderAdviceMarkdown } from "./render.ts";

/**
 * 정규화된 턴 요약 → 사람이 읽을 코칭 텍스트(터미널용).
 * 조언할 내용이 없으면 null (가짜 채움 금지).
 */
export function adviseOnTurn(summary: TurnSummary, opts?: AdviceOptions): string | null {
  const buckets = buildAdvice(summary, opts);
  if (!buckets.length) return null;
  return renderAdvice(buckets);
}

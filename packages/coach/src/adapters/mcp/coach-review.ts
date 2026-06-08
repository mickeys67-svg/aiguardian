// MCP 어댑터 (수동 조언) — 코어 입력으로 정규화하는 순수 로직.
//
// 훅이 없는 클라이언트(Claude Desktop·Cline·Copilot·Continue…)에서도 부를 수 있는
// on-demand 코치. 모델/사용자가 "방금 무엇을 했는지"를 넘기면 5버킷 코칭을 돌려준다.
// (ADR-0004: 수동 조언 = 전 클라 호환 MCP 도구. 능동 조언은 클라별 훅 어댑터.)
//
// 능동(Stop 훅) 어댑터와 똑같은 코어를 쓴다 — 입력 출처만 transcript 대신 도구 인자.

import { adviseOnTurnMarkdown } from "../../core/index.ts";
import type { TurnSummary } from "../../core/types.ts";

/** 도구 인자(느슨한 입력). 모델이 채워 넘긴다. 모두 선택. */
export interface CoachReviewInput {
  userPrompt?: string;
  filesChanged?: { path: string; action?: "create" | "edit" }[];
  commandsRun?: { command: string; failed?: boolean }[];
  userMustRun?: string[];
  hadError?: boolean;
}

/** 느슨한 입력을 코어의 정규화 입력(TurnSummary)으로. */
export function toTurnSummary(input: CoachReviewInput): TurnSummary {
  return {
    userPrompt: input.userPrompt?.trim() ?? "",
    filesChanged: (input.filesChanged ?? []).map((f) => ({
      path: f.path,
      action: f.action === "edit" ? "edit" : "create",
    })),
    commandsRun: (input.commandsRun ?? []).map((c) => ({
      command: c.command,
      failed: Boolean(c.failed),
    })),
    userMustRun: input.userMustRun ?? [],
    hadError: Boolean(input.hadError),
  };
}

/**
 * 코칭 마크다운을 만든다. 조언할 게 없으면 안내 문구.
 * (코어가 빈 버킷을 만들지 않으므로, 입력이 비면 null → 친절한 fallback.)
 */
export function runCoachReview(input: CoachReviewInput): string {
  const md = adviseOnTurnMarkdown(toTurnSummary(input));
  return (
    md ??
    "방금 턴에서 짚어드릴 만한 변화가 안 보였어요. 파일을 만들거나 명령을 실행한 뒤 다시 불러주세요."
  );
}

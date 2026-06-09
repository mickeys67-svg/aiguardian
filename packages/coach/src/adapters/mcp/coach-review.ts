// MCP 어댑터 (수동 조언) — 코어 입력으로 정규화하는 순수 로직.
//
// 훅이 없는 클라이언트(Claude Desktop·Cline·Copilot·Continue…)에서도 부를 수 있는
// on-demand 코치. 모델/사용자가 "방금 무엇을 했는지"를 넘기면 5버킷 코칭을 돌려준다.
// (ADR-0004: 수동 조언 = 전 클라 호환 MCP 도구. 능동 조언은 클라별 훅 어댑터.)
//
// 능동(Stop 훅) 어댑터와 똑같은 코어를 쓴다 — 입력 출처만 transcript 대신 도구 인자.

import { buildAdvice, renderAdviceMarkdown } from "../../core/index.ts";
import type { AdviceBucket } from "../../core/index.ts";
import type { TurnSummary } from "../../core/types.ts";

/** 도구 인자(느슨한 입력). 모델이 채워 넘긴다. 모두 선택. */
export interface CoachReviewInput {
  userPrompt?: string;
  filesChanged?: { path: string; action?: "create" | "edit" }[];
  commandsRun?: { command: string; failed?: boolean }[];
  userMustRun?: string[];
  hadError?: boolean;
  // ── 세션 AI가 '직접 맥락으로' 써넣는 주관적 코칭(규칙이 못 만드는 부분) ──
  /** 이번 턴에 사용자가 실제로 잘 해낸 점 한 줄. 사실 기반. 없으면 생략. */
  encouragement?: string;
  /** 지금 맥락에 맞는 다음 선택지 2~3개. 각 항목은 사용자가 시킬 말('~해줘') 형태. */
  ideas?: string[];
  /** 코칭 작성 언어(BCP-47). 세션 AI가 사용자 대화 언어를 '선언'한다. 미지정 시 'ko'. */
  locale?: string;
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

const NO_ADVICE =
  "방금 턴에서 짚어드릴 만한 변화가 안 보였어요. 파일을 만들거나 명령을 실행한 뒤 다시 불러주세요.";

/**
 * 한 턴을 코칭한다. buckets(HUD 라이브 채널용)와 사람이 읽을 text(도구 응답용)를 함께 반환.
 * 순수 함수 — 파일 쓰기 같은 부작용은 어댑터 진입점(server.ts)이 맡는다(stop-hook 과 동일).
 * (코어가 빈 버킷을 만들지 않으므로, 짚을 게 없으면 buckets=[] + 친절한 fallback text.)
 */
export function reviewTurn(input: CoachReviewInput): {
  buckets: AdviceBucket[];
  text: string;
} {
  // 사실은 정규화 입력(TurnSummary)으로, 주관(격려·아이디어)은 derived 로 — 코어가 가드레일을 건다.
  const buckets = buildAdvice(toTurnSummary(input), {
    derived: { encouragement: input.encouragement, ideas: input.ideas },
    ...(input.locale ? { locale: input.locale } : {}),
  });
  const text = buckets.length ? renderAdviceMarkdown(buckets) : NO_ADVICE;
  return { buckets, text };
}

/** 텍스트만 필요한 경로(데모·하위호환)용 얇은 래퍼. */
export function runCoachReview(input: CoachReviewInput): string {
  return reviewTurn(input).text;
}

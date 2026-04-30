// AI Roundtripper — v0.9 §4.2 모듈 #5
//
// 에러 발생 → 컨텍스트 구성 → 클립보드에 자동 복사 → 사용자가 AI에 붙여넣기.
// v1.0 부터는 MCP 직결로 자동 호출까지 확장.

import { writeText } from "@tauri-apps/plugin-clipboard-manager";

export interface ErrorContext {
  command: string;
  cwd?: string | null;
  stdout?: string;
  stderr: string;
  recipeId?: string | null;
  stepId?: string | null;
}

/**
 * 에러를 사람이 AI 에 붙여넣기 좋은 형태로 포맷.
 * 한국어 헤더 + 기술 컨텍스트 영문 보존.
 */
export function formatErrorForAi(ctx: ErrorContext): string {
  const lines = [
    "안녕하세요. TG (Terminal Guardian) 사용자예요. 코드를 실행하다 에러를 만났어요. 한국어로 원인과 해결책을 알려주실 수 있나요?",
    "",
    "## 실행한 명령",
    "```",
    ctx.command,
    "```",
  ];

  if (ctx.cwd) {
    lines.push("", `**작업 디렉토리**: \`${ctx.cwd}\``);
  }

  if (ctx.recipeId) {
    lines.push("", `**레시피**: ${ctx.recipeId}${ctx.stepId ? ` / 단계 ${ctx.stepId}` : ""}`);
  }

  lines.push("", "## 표준 출력");
  lines.push("```", ctx.stdout?.trim() || "(빈 출력)", "```");

  lines.push("", "## 에러 메시지");
  lines.push("```", ctx.stderr.trim() || "(stderr 없음)", "```");

  lines.push(
    "",
    "## 부탁",
    "1. 이 에러가 무슨 뜻인지 한국어로 한 줄 설명",
    "2. 입문자가 따라할 수 있는 해결 단계 (가능하면 안전한 방향으로)",
    "3. 다시 시도할 때 주의할 점",
  );

  return lines.join("\n");
}

/** 에러 컨텍스트를 클립보드에 복사. 성공 시 true. */
export async function copyErrorToClipboard(ctx: ErrorContext): Promise<boolean> {
  try {
    await writeText(formatErrorForAi(ctx));
    return true;
  } catch (err) {
    console.error("clipboard write failed", err);
    return false;
  }
}

// 렌더러 (코어) — 구조화된 5버킷 조언을 텍스트로. 클라이언트 독립.
// 명령(command) 항목은 들여쓰기/코드로 구분해 보여준다.

import type { AdviceBucket, AdviceItem } from "./types.ts";

const RULE = "─".repeat(60);

/** 터미널용 — systemMessage/user_message 로 흘려보낼 텍스트. */
export function renderAdvice(buckets: AdviceBucket[]): string {
  const out: string[] = ["", RULE, "🧭 잠깐 — 방금 한 턴을 함께 짚어볼게요", RULE];
  for (const b of buckets) {
    out.push("", `${b.icon} ${b.title}`);
    for (const item of b.items) {
      out.push(item.kind === "command" ? `    ${item.command}` : `   • ${item.text}`);
    }
  }
  out.push("", RULE);
  return out.join("\n");
}

/** 마크다운 — MCP 도구 응답 등 "텍스트 콘텐츠"로 돌려줄 때. */
export function renderAdviceMarkdown(buckets: AdviceBucket[]): string {
  const out: string[] = ["## 🧭 잠깐 — 방금 한 턴을 함께 짚어볼게요"];
  for (const b of buckets) {
    out.push("", `### ${b.icon} ${b.title}`);
    for (const item of b.items) {
      out.push(item.kind === "command" ? `- \`${item.command}\`` : `- ${item.text}`);
    }
  }
  return out.join("\n");
}

export type { AdviceItem };

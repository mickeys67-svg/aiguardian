// 렌더러 (코어) — 5버킷 조언을 터미널에 보여줄 사람 읽기 좋은 텍스트로. 클라이언트 독립.
// (박스 폭은 한글 2칸 폭 때문에 계산이 까다로워, 단순 구분선 방식으로 안정성 우선.)

import type { AdviceBucket } from "./advice.ts";

const RULE = "─".repeat(60);

export function renderAdvice(buckets: AdviceBucket[]): string {
  const out: string[] = [];
  out.push("");
  out.push(RULE);
  out.push("🧭 잠깐 — 방금 한 턴을 함께 짚어볼게요");
  out.push(RULE);
  for (const b of buckets) {
    out.push("");
    out.push(`${b.icon} ${b.title}`);
    for (const line of b.lines) {
      // 들여쓰기된 줄(명령 등)은 그대로, 일반 줄은 불릿.
      out.push(line.startsWith("    ") ? line : `   • ${line}`);
    }
  }
  out.push("");
  out.push(RULE);
  return out.join("\n");
}

/**
 * 마크다운 렌더 — MCP 도구 응답 등 "텍스트 콘텐츠"로 돌려줄 때.
 * 터미널 박스 대신 헤딩/불릿/코드로 표현.
 */
export function renderAdviceMarkdown(buckets: AdviceBucket[]): string {
  const out: string[] = ["## 🧭 잠깐 — 방금 한 턴을 함께 짚어볼게요"];
  for (const b of buckets) {
    out.push("", `### ${b.icon} ${b.title}`);
    for (const line of b.lines) {
      // 들여쓰기된 줄(명령)은 인라인 코드 불릿으로.
      out.push(line.startsWith("    ") ? `- \`${line.trim()}\`` : `- ${line}`);
    }
  }
  return out.join("\n");
}

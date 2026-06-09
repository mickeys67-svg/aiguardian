#!/usr/bin/env node
// Claude Code 어댑터 진입점 — Stop 훅. 개발 턴이 끝나는 순간 발화한다.
//
// 동작:
//   1) stdin 으로 Stop 훅 JSON(transcript_path 등)을 받는다.
//   2) transcript 를 코어 입력(TurnSummary)으로 정규화해 사실층 코칭을 만든다.
//   3) 조언을 `systemMessage`(사용자 전용)로 출력 — AI 컨텍스트엔 안 들어감(ADR-0004 스탠스).
//      → 즉 AI를 떠밀지 않고, 사람(입문자)에게만 코칭한다.
//
// enriched(맞춤 격려·아이디어)는 세션 AI가 coach_review(MCP)를 호출할 때만 채워진다(자동 아님).
// 훅은 그걸 강제하지 않는다 — decision:block 으로 모델을 깨우는 '부스터'는 AI 떠밀기라
// 스탠스에 어긋나므로 코드에서 제외했다. 자호출률은 먼저 아래 캡처로 실측한다.
//
// 실측(env TG_COACH_CAPTURE=1): 받은 원본 입력 JSON 을 ~/.tg-coach/hook-capture.jsonl 에
//   기록만 한다(읽기전용·exit 0). stop_hook_active 실재/동작을 안전하게 관측하는 용도.
//   (docs/coach-self-invoke-measurement.md)
//
// 데모: `node stop-hook.ts --demo` → 샘플 transcript 로 조언 출력.

import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { summarizeLastTurn } from "./transcript.ts";
import { buildAdvice, renderAdvice } from "../../core/index.ts";
import { writeCoachState } from "../../shared/state.ts";

const here = dirname(fileURLToPath(import.meta.url));

// 잘된 턴의 수동 유도(systemMessage = 사용자 전용). enriched 는 세션 AI가 coach_review 를
// 부를 때만 채워지므로(자동 아님), 더 맞춤한 코칭을 원하면 사용자가 직접 부르도록 안내한다.
const ENRICH_NUDGE = '\n💬 더 맞춤한 격려·다음 선택지가 필요하면 "코치 봐줘"라고 해보세요.';

/** transcript 텍스트 → 렌더된 조언 문자열(조언 없으면 null). 동시에 HUD 상태(phase=facts) 기록. */
function adviseFromTranscript(jsonl: string): string | null {
  const summary = summarizeLastTurn(jsonl);
  if (!summary) return null;
  const buckets = buildAdvice(summary);
  if (!buckets.length) return null;
  writeCoachState(buckets, "claude-code", { phase: "facts" }); // 1박자: 사실 즉시 → HUD
  // 잘된 턴(에러 없음)에만 수동 유도를 덧붙인다. 에러 턴엔 톤 배려로 생략.
  const hasDerived = buckets.some((b) => b.key === "ideas");
  const nudge = !summary.hadError && !hasDerived ? ENRICH_NUDGE : "";
  return renderAdvice(buckets) + nudge;
}

function runDemo(): void {
  // src/adapters/claude-code → 패키지 루트 → test/
  const samplePath = join(here, "..", "..", "..", "test", "sample-transcript.jsonl");
  const advice = adviseFromTranscript(readFileSync(samplePath, "utf8"));
  process.stdout.write((advice ?? "(조언할 내용이 없어요)") + "\n");
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (buf += c));
    process.stdin.on("end", () => resolve(buf));
    if (process.stdin.isTTY) resolve("");
  });
}

/** 실측(opt-in): 받은 원본 입력을 한 줄씩 기록만 한다(읽기전용, 절대 흐름 안 막음). */
function maybeCapture(raw: string): void {
  if (process.env.TG_COACH_CAPTURE !== "1") return;
  try {
    const dir = join(homedir(), ".tg-coach");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "hook-capture.jsonl"), raw.trim() + "\n", "utf8");
  } catch {
    /* 캡처 실패는 무해 — 훅 흐름과 무관 */
  }
}

async function runHook(): Promise<void> {
  const raw = await readStdin();
  maybeCapture(raw); // 실측(opt-in): 원본 입력(stop_hook_active 포함) 기록

  let transcriptPath = "";
  try {
    transcriptPath = (JSON.parse(raw) as { transcript_path?: string }).transcript_path ?? "";
  } catch {
    // 입력이 깨졌어도 훅은 조용히 통과(개발 흐름을 절대 막지 않는다).
  }
  if (!transcriptPath) process.exit(0);

  let advice: string | null = null;
  try {
    advice = adviseFromTranscript(readFileSync(transcriptPath, "utf8"));
  } catch {
    process.exit(0);
  }
  if (!advice) process.exit(0);

  // 사용자에게만 보이는 systemMessage 로 노출. AI 컨텍스트(additionalContext)는 쓰지 않는다.
  process.stdout.write(JSON.stringify({ systemMessage: advice }));
  process.exit(0);
}

if (process.argv.includes("--demo")) {
  runDemo();
} else {
  void runHook();
}

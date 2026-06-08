#!/usr/bin/env node
// Claude Code 어댑터 진입점 — Stop 훅. 개발 턴이 끝나는 순간 발화한다.
//
// 동작:
//   1) stdin 으로 Stop 훅 JSON(transcript_path 등)을 받는다.
//   2) transcript 를 코어 입력(TurnSummary)으로 정규화한다.
//   3) 코어가 만든 조언을 `systemMessage` 로 출력한다.
//      → systemMessage 는 "사용자 터미널"에만 표시되고 AI 컨텍스트에는 들어가지 않는다.
//      → 즉 AI를 떠밀지 않고, 사람(입문자)에게만 코칭한다. (ADR-0004 스탠스 핵심)
//
// ⚠️ 프로토타입 주의: `systemMessage` 필드명/표시 방식은 설치된 Claude Code 버전의
//    훅 출력 스키마와 한 번 대조가 필요하다. (docs/en/hooks 참고)
//
// 데모: `node src/adapters/claude-code/stop-hook.ts --demo` → 샘플 transcript 로 조언 출력.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { summarizeLastTurn } from "./transcript.ts";
import { adviseOnTurn } from "../../core/index.ts";

const here = dirname(fileURLToPath(import.meta.url));

/** transcript 텍스트 → 렌더된 조언 문자열(조언 없으면 null). */
function adviseFromTranscript(jsonl: string): string | null {
  const summary = summarizeLastTurn(jsonl);
  if (!summary) return null;
  return adviseOnTurn(summary);
}

function runDemo(): void {
  // src/adapters/claude-code → 패키지 루트 → test/
  const samplePath = join(here, "..", "..", "..", "test", "sample-transcript.jsonl");
  const jsonl = readFileSync(samplePath, "utf8");
  const advice = adviseFromTranscript(jsonl);
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

async function runHook(): Promise<void> {
  const raw = await readStdin();
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

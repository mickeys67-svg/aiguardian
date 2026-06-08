#!/usr/bin/env node
// Cursor 어댑터 진입점 — Cursor 훅(`stop` / `afterAgentResponse`). 개발 턴이 끝날 때 발화.
//
// Claude Code 어댑터와 코어·파서는 똑같이 쓰고, 두 가지만 다르다:
//   1) Cursor 훅 입력에서 transcript 경로를 꺼낸다(transcript_path / conversation 등).
//   2) 사용자에게 보이는 출력 필드가 `user_message` 다 (Claude Code 는 systemMessage).
//      → Cursor 의 `agent_message`(모델로) / `followup_message`(다음 턴 자동 제출)는
//         쓰지 않는다. 우리는 AI를 떠밀지 않고 사람에게만 코칭한다. (ADR-0004 스탠스)
//
// ⚠️ Cursor 훅은 베타 — 입력/출력 스키마가 버전마다 변할 수 있다. 또한 Cursor transcript 의
//    실제 JSONL 모양이 Anthropic식과 다르면 shared/transcript 파서를 분기해야 한다.
//    설치된 Cursor 버전의 hooks 문서로 한 번 대조할 것.
//
// 데모: node src/adapters/cursor/stop-hook.ts --demo

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { summarizeLastTurn } from "../../shared/transcript.ts";
import { adviseOnTurn } from "../../core/index.ts";

const here = dirname(fileURLToPath(import.meta.url));

function adviseFromTranscript(jsonl: string): string | null {
  const summary = summarizeLastTurn(jsonl);
  if (!summary) return null;
  return adviseOnTurn(summary);
}

/** Cursor 훅 입력에서 transcript 파일 경로를 꺼낸다(여러 후보 키를 방어적으로). */
function transcriptPathFrom(raw: string): string {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    return String(
      o.transcript_path ?? o.transcriptPath ?? o.conversation_path ?? "",
    ).trim();
  } catch {
    return "";
  }
}

function runDemo(): void {
  // src/adapters/cursor → 패키지 루트 → test/
  const samplePath = join(here, "..", "..", "..", "test", "sample-transcript.jsonl");
  const advice = adviseFromTranscript(readFileSync(samplePath, "utf8"));
  // 데모는 실제 훅 출력(JSON)을 그대로 보여준다.
  process.stdout.write(JSON.stringify({ user_message: advice ?? "(조언 없음)" }, null, 2) + "\n");
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
  const transcriptPath = transcriptPathFrom(raw);
  if (!transcriptPath) process.exit(0);

  let advice: string | null = null;
  try {
    advice = adviseFromTranscript(readFileSync(transcriptPath, "utf8"));
  } catch {
    process.exit(0);
  }
  if (!advice) process.exit(0);

  // Cursor UI 에 사용자에게만 보이는 메시지로 노출. agent_message 는 쓰지 않는다.
  process.stdout.write(JSON.stringify({ user_message: advice }));
  process.exit(0);
}

if (process.argv.includes("--demo")) {
  runDemo();
} else {
  void runHook();
}

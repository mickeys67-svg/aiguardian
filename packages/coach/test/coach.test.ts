// @tg/coach 자동화 테스트 — node:test (Node 24 타입 스트리핑으로 .ts 직접 실행).
// 실행: pnpm --filter @tg/coach test  (= node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { buildAdvice, adviseOnTurn, renderAdviceMarkdown } from "../src/core/index.ts";
import type { TurnSummary } from "../src/core/index.ts";
import {
  summarizeLastTurn,
  extractUserCommands,
} from "../src/shared/transcript.ts";
import { writeCoachState, coachStatePath } from "../src/shared/state.ts";

const here = dirname(fileURLToPath(import.meta.url));

const webTurn: TurnSummary = {
  userPrompt: "할 일 목록 웹페이지 만들어줘",
  filesChanged: [
    { path: "todo/index.html", action: "create" },
    { path: "todo/main.js", action: "create" },
  ],
  commandsRun: [{ command: "cd todo && npm install", failed: false }],
  userMustRun: ["npm run dev"],
  hadError: false,
};

const emptyTurn: TurnSummary = {
  userPrompt: "고마워!",
  filesChanged: [],
  commandsRun: [],
  userMustRun: [],
  hadError: false,
};

const errorTurn: TurnSummary = {
  userPrompt: "빌드해줘",
  filesChanged: [],
  commandsRun: [{ command: "npm run build", failed: true }],
  userMustRun: [],
  hadError: true,
};

// ── core: buildAdvice ──────────────────────────────────────────

test("web 턴은 recap·verify·do·missed·next 버킷을 만든다", () => {
  const keys = buildAdvice(webTurn).map((b) => b.key);
  assert.deepEqual(keys, ["recap", "verify", "do", "missed", "next"]);
});

test("do 버킷에 사용자 직접 실행 명령이 command 항목으로 들어간다", () => {
  const doBucket = buildAdvice(webTurn).find((b) => b.key === "do")!;
  const cmds = doBucket.items.filter((i) => i.kind === "command");
  assert.equal(cmds.length, 1);
  assert.equal((cmds[0] as { command: string }).command, "npm run dev");
});

test("OS 인자가 터미널 이름을 바꾼다 (windows→PowerShell, macos→터미널)", () => {
  const win = JSON.stringify(buildAdvice(webTurn, { os: "windows" }));
  const mac = JSON.stringify(buildAdvice(webTurn, { os: "macos" }));
  assert.ok(win.includes("PowerShell"));
  assert.ok(mac.includes("터미널(Terminal)"));
});

test("빈 턴(아무 일도 안 함)은 조언을 만들지 않는다", () => {
  assert.deepEqual(buildAdvice(emptyTurn), []);
  assert.equal(adviseOnTurn(emptyTurn), null);
});

test("에러 턴은 verify 에 에러 안내 + next 에 에러 고치기 가이드", () => {
  const buckets = buildAdvice(errorTurn);
  const verify = buckets.find((b) => b.key === "verify")!;
  assert.ok(JSON.stringify(verify).includes("에러"));
  const next = buckets.find((b) => b.key === "next")!;
  assert.ok(JSON.stringify(next).includes("이 에러 고쳐줘"));
});

test("마크다운 렌더는 명령을 인라인 코드로 표시", () => {
  const md = renderAdviceMarkdown(buildAdvice(webTurn));
  assert.ok(md.includes("`npm run dev`"));
});

// ── shared: transcript ─────────────────────────────────────────

test("샘플 transcript 를 정확히 요약한다", () => {
  const jsonl = readFileSync(join(here, "sample-transcript.jsonl"), "utf8");
  const s = summarizeLastTurn(jsonl)!;
  assert.equal(s.filesChanged.length, 3);
  assert.equal(s.commandsRun.length, 2);
  assert.ok(s.userMustRun.includes("npm run dev"));
  assert.equal(s.hadError, false);
});

test("tool_result is_error 가 있으면 hadError=true", () => {
  const jsonl = [
    JSON.stringify({ type: "user", message: { role: "user", content: "빌드해줘" } }),
    JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id: "x1", name: "Bash", input: { command: "npm run build" } }],
      },
    }),
    JSON.stringify({
      type: "user",
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: "x1", is_error: true, content: "error" }] },
    }),
  ].join("\n");
  const s = summarizeLastTurn(jsonl)!;
  assert.equal(s.hadError, true);
  assert.equal(s.commandsRun[0]!.failed, true);
});

test("빈/깨진 transcript 는 null 을 돌려 막히지 않는다", () => {
  assert.equal(summarizeLastTurn(""), null);
  assert.equal(summarizeLastTurn("{not json}\n{also bad}"), null);
});

test("extractUserCommands 는 코드펜스와 인라인 백틱에서 명령을 뽑는다", () => {
  const fence = extractUserCommands("이렇게 실행하세요:\n```bash\nnpm run dev\n```");
  assert.ok(fence.includes("npm run dev"));
  const inline = extractUserCommands("터미널에 `git status` 쳐보세요");
  assert.ok(inline.includes("git status"));
});

// ── shared: state (HUD 라이브 채널) ────────────────────────────

test("writeCoachState 가 상태 파일을 읽어올 수 있게 기록한다", () => {
  const buckets = buildAdvice(webTurn);
  writeCoachState(buckets, "test");
  const saved = JSON.parse(readFileSync(coachStatePath(), "utf8"));
  assert.equal(saved.source, "test");
  assert.equal(saved.buckets.length, buckets.length);
  assert.ok(typeof saved.updatedAt === "string");
});

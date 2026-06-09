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
import { writeCoachState, deleteCoachState, coachStatePath } from "../src/shared/state.ts";

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

test("도출 입력이 없으면 사실 버킷만 — ideas 는 안 뜬다(규칙 캔 문구 금지)", () => {
  const keys = buildAdvice(webTurn).map((b) => b.key);
  assert.deepEqual(keys, ["encourage", "recap", "verify", "do", "missed", "next"]);
});

test("성공 턴은 맨 앞에 격려(encourage). 도출 격려 없으면 사실 기반으로 폴백한다", () => {
  const buckets = buildAdvice(webTurn);
  assert.equal(buckets[0]!.key, "encourage");
  assert.ok(JSON.stringify(buckets[0]).includes("👍")); // 폴백 한 줄
});

test("세션 AI가 도출한 격려·아이디어를 쓴다 (격려는 도출분 우선, ideas 버킷 등장)", () => {
  const buckets = buildAdvice(webTurn, {
    derived: {
      encouragement: "할 일 목록의 뼈대를 직접 잡으셨네요, 좋은 출발이에요 👍",
      ideas: ['"완료한 항목에 취소선을 그어줘"', '"새로고침해도 목록이 남게 해줘"'],
    },
  });
  assert.equal(buckets[0]!.key, "encourage");
  assert.ok(JSON.stringify(buckets[0]).includes("뼈대를 직접"));
  const ideas = buckets.find((b) => b.key === "ideas")!;
  assert.equal(ideas.items.length, 2);
});

test("가드레일: ideas 의 스탠스 누수('제가 ~할게요')·코드펜스를 떨어낸다", () => {
  const buckets = buildAdvice(webTurn, {
    derived: { ideas: ["제가 다크모드를 추가할게요", "```npm i```", '"버튼 색을 바꿔줘"'] },
  });
  const ideas = buckets.find((b) => b.key === "ideas")!;
  assert.equal(ideas.items.length, 1);
  assert.ok(JSON.stringify(ideas.items[0]).includes("버튼 색"));
});

test("가드레일: 영어 약속형 스탠스 누수('I'll add…')도 떨어낸다 (fail-open 차단)", () => {
  const buckets = buildAdvice(webTurn, {
    derived: { ideas: ["I'll add a dark mode for you", "let me wire the form", '"connect the form to email"'] },
  });
  const ideas = buckets.find((b) => b.key === "ideas")!;
  assert.equal(ideas.items.length, 1); // 앞의 둘은 탈락, 사용자 지시형만 통과
  assert.ok(JSON.stringify(ideas.items[0]).includes("connect the form"));
});

test("locale 을 넘겨도 깨지지 않고 사실 버킷은 그대로다 (ko 전용 규칙)", () => {
  const buckets = buildAdvice(webTurn, { locale: "en" });
  assert.equal(buckets[0]!.key, "encourage"); // 비-에러 턴 격려 불변
  assert.ok(buckets.some((b) => b.key === "recap"));
});

test("가드레일: 명령을 끼운 격려는 폴백(사실 기반)으로 대체된다", () => {
  const buckets = buildAdvice(webTurn, {
    derived: { encouragement: "잘하셨어요 👍\n```\nnpm run build\n```" },
  });
  assert.equal(buckets[0]!.key, "encourage");
  assert.ok(!JSON.stringify(buckets[0]).includes("npm run build")); // 새치기 차단 → 폴백
});

test("에러 턴은 도출 입력이 와도 격려·아이디어를 만들지 않는다 (톤 배려·스탠스 안전장치)", () => {
  const keys = buildAdvice(errorTurn, {
    derived: { encouragement: "그래도 잘하셨어요", ideas: ["다시 해보자"] },
  }).map((b) => b.key);
  assert.ok(!keys.includes("encourage"));
  assert.ok(!keys.includes("ideas"));
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
  deleteCoachState(); // 직전 run 의 enriched 잔류가 facts 가드에 걸리지 않게 결정적으로
  const buckets = buildAdvice(webTurn);
  writeCoachState(buckets, "test");
  const saved = JSON.parse(readFileSync(coachStatePath(), "utf8"));
  assert.equal(saved.source, "test");
  assert.equal(saved.buckets.length, buckets.length);
  assert.ok(typeof saved.updatedAt === "string");
});

test("race 가드: facts 쓰기는 최근 enriched 를 덮지 않는다", () => {
  const enriched = buildAdvice(webTurn, { derived: { ideas: ['"버튼 추가해줘"'] } });
  writeCoachState(enriched, "claude-desktop", { phase: "enriched", locale: "ko" });
  // 곧바로 훅이 facts 로 쓰려 해도(같은 턴 창) enriched 가 살아남아야 한다.
  writeCoachState(buildAdvice(webTurn), "claude-code", { phase: "facts" });
  const saved = JSON.parse(readFileSync(coachStatePath(), "utf8"));
  assert.equal(saved.phase, "enriched");
  assert.equal(saved.locale, "ko");
  assert.ok(saved.buckets.some((b: { key: string }) => b.key === "ideas"));
});

test("deleteCoachState 가 상태 파일을 폐기한다(끄기 시 잔류 제거)", () => {
  writeCoachState(buildAdvice(webTurn), "test", { phase: "facts" });
  deleteCoachState();
  assert.throws(() => readFileSync(coachStatePath(), "utf8")); // 파일 없음
});

// (부스터 결정 로직은 ADR-0004 스탠스 위반으로 제거됨 — 자호출률은 캡처로 실측 후 재검토.)

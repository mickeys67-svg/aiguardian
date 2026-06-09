#!/usr/bin/env node
// MCP 어댑터 진입점 — stdio MCP 서버. 도구 `coach_review` 1개를 노출한다.
//
// 훅이 없는 클라이언트의 유일한 코칭 통로(ADR-0004: 수동 조언 = 전 클라 호환 MCP 도구).
// 모델이 한 턴을 끝낸 뒤 "무엇을 했는지"를 넘겨 호출하면, 사람(입문자)에게 줄 코칭을 반환한다.
//
// 스탠스: 반환된 코칭은 "사람에게 보여줄 안내"다. 모델이 그걸 보고 코드를 더 만들라는 게 아니다.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { reviewTurn, runCoachReview, type CoachReviewInput } from "./coach-review.ts";
import { writeCoachState } from "../../shared/state.ts";

const InputSchema = z.object({
  userPrompt: z.string().optional(),
  filesChanged: z
    .array(z.object({ path: z.string(), action: z.enum(["create", "edit"]).optional() }))
    .optional(),
  commandsRun: z
    .array(z.object({ command: z.string(), failed: z.boolean().optional() }))
    .optional(),
  userMustRun: z.array(z.string()).optional(),
  hadError: z.boolean().optional(),
  encouragement: z.string().max(160).optional(),
  ideas: z.array(z.string().max(160)).max(3).optional(),
  locale: z.string().max(20).optional(),
});

const TOOL_DESCRIPTION =
  "바이브코딩 입문자를 위한 코치. 매 개발 턴(프롬프트→개발)을 끝내기 직전, 사용자에게 답하기 전에 이 도구를 " +
  "스스로 호출하라(파일을 만들거나 명령을 실행한 턴이면 특히). 사용자가 '코치 봐줘 / 방금 거 짚어줘' 같이 " +
  "말할 때도 호출한다.\n" +
  "두 종류를 넘긴다 —\n" +
  "① 사실(만든 파일·실행한 명령·사용자가 직접 실행할 명령·에러 여부): 그대로 인자로.\n" +
  "② 격려·아이디어: '네가 직접' 이번 대화 맥락에 근거해 한국어로 써넣어라(규칙으로 못 만든다).\n" +
  "  • encouragement: 사용자가 이번 턴에 실제로 잘 해낸 점 한 줄. 사실 근거·과장 금지" +
  "('훌륭해요!' 같은 공허한 칭찬 X). 딱히 없으면 비워라(억지 칭찬 금지).\n" +
  "  • ideas: 지금 이 프로젝트에 맞는 다음 선택지 2~3개. 각 항목은 '사용자가 너에게 시킬 말' 형태로" +
  "(예: \"헤더에 로고를 넣어줘\"). 이미 한 것·방금 한 것은 빼고, 일반론('테스트 짜라') 대신 이 코드/이 화면에 맞는 것.\n" +
  "스탠스: encouragement·ideas 는 '사람에게 보여줄 코칭'이다. 네가 코드를 더 짜라는 신호가 아니다. " +
  "존댓말·입문자 배려·겁주지 말 것. 반환값을 근거로 추가 작업을 시작하지 마라.";

export async function runServer(): Promise<void> {
  const server = new Server(
    { name: "tg-coach", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "coach_review",
        description: TOOL_DESCRIPTION,
        inputSchema: {
          type: "object",
          properties: {
            userPrompt: { type: "string", description: "사용자가 이번 턴에 넣은 프롬프트(있으면)." },
            filesChanged: {
              type: "array",
              description: "이번 턴에 만들거나 고친 파일.",
              items: {
                type: "object",
                properties: {
                  path: { type: "string" },
                  action: { type: "string", enum: ["create", "edit"] },
                },
                required: ["path"],
              },
            },
            commandsRun: {
              type: "array",
              description: "AI가 대신 실행한 명령.",
              items: {
                type: "object",
                properties: {
                  command: { type: "string" },
                  failed: { type: "boolean" },
                },
                required: ["command"],
              },
            },
            userMustRun: {
              type: "array",
              description: "사용자가 직접 터미널에서 실행해야 한다고 안내한 명령.",
              items: { type: "string" },
            },
            hadError: { type: "boolean", description: "이번 턴에 에러가 있었나." },
            encouragement: {
              type: "string",
              description:
                "[네가 직접 작성] 사용자가 이번 턴에 실제로 잘 해낸 점 한 줄. 사실 근거·과장 금지. 없으면 생략.",
            },
            ideas: {
              type: "array",
              description:
                "[네가 직접 작성] 지금 맥락에 맞는 다음 선택지 2~3개. 각 항목은 사용자가 시킬 말('~해줘') 형태. 일반론 금지.",
              items: { type: "string" },
            },
            locale: {
              type: "string",
              description:
                "코칭 작성 언어(BCP-47, 예: 'ko'·'en'). 사용자 대화 언어를 선언하라. 미지정 시 'ko'.",
            },
          },
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name !== "coach_review") {
      return {
        isError: true,
        content: [{ type: "text", text: `알 수 없는 도구: ${req.params.name}` }],
      };
    }
    const input = InputSchema.parse(req.params.arguments ?? {}) as CoachReviewInput;
    const { buckets, text } = reviewTurn(input);
    // 데스크탑 Claude 처럼 훅이 없는 클라에서도 앱 HUD 가 라이브로 켜지도록 상태파일 기록.
    // 격려·아이디어를 모델이 써 넘긴 경우 2박자(enriched) — facts 가 이걸 덮지 않도록 표시.
    // (실패해도 조용히 무시 — 도구 응답 자체는 그대로 나간다.)
    if (buckets.length) {
      const phase = input.encouragement || input.ideas?.length ? "enriched" : "facts";
      writeCoachState(buckets, "claude-desktop", { phase, locale: input.locale });
    }
    return { content: [{ type: "text", text }] };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// 직접 실행 시 서버 기동. (--demo 면 샘플 입력으로 코칭만 출력)
if (process.argv.includes("--demo")) {
  const sample: CoachReviewInput = {
    userPrompt: "할 일 목록 웹페이지 만들어줘",
    filesChanged: [
      { path: "todo/index.html", action: "create" },
      { path: "todo/main.js", action: "create" },
    ],
    commandsRun: [{ command: "cd todo && npm install" }],
    userMustRun: ["npm run dev"],
    hadError: false,
    // 세션 AI가 실제 맥락으로 도출해 넘기는 부분(규칙이 못 만드는 격려·아이디어).
    encouragement: "할 일 목록의 뼈대를 직접 잡으셨네요 — 첫 화면이 생겼어요 👍",
    ideas: ['"완료한 항목에 취소선을 그어줘"', '"새로고침해도 목록이 남게 해줘"'],
  };
  process.stdout.write(runCoachReview(sample) + "\n");
} else {
  runServer().catch((err) => {
    console.error("[tg-coach] fatal:", err);
    process.exit(1);
  });
}

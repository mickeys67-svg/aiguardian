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
});

const TOOL_DESCRIPTION =
  "바이브코딩 입문자를 위한 코치. 한 개발 턴(프롬프트→개발)을 끝낸 직후, 방금 무엇을 " +
  "했는지(만든 파일·실행한 명령·사용자가 직접 실행해야 할 명령·에러 여부)를 넘겨 호출하면, " +
  "그 사람에게 보여줄 한국어 코칭(무슨 일/확인할 것/직접 할 일/놓친 것/다음 방향)을 돌려준다. " +
  "반환값은 '사람에게 보여줄 안내'다 — 이걸 근거로 코드를 더 만들지 말 것.";

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
    // (실패해도 조용히 무시 — 도구 응답 자체는 그대로 나간다.)
    if (buckets.length) writeCoachState(buckets, "claude-desktop");
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
  };
  process.stdout.write(runCoachReview(sample) + "\n");
} else {
  runServer().catch((err) => {
    console.error("[tg-coach] fatal:", err);
    process.exit(1);
  });
}

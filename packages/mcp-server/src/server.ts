// TG MCP 서버 — 환경 진단(tg_scan) 전용.
//
// 스탠스(ADR-0004): 앱/서버는 사용자의 명령을 대신 실행하지 않는다. 그래서 옛
// tg_run_command(셸 실행)·tg_deploy(배포)는 제거했다. 남은 tg_scan 은 "무엇이
// 깔려있나"를 읽는 read-only 진단으로, 코치가 빈칸을 짚을 때 쓰는 정보일 뿐이다.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "node:child_process"; // stance-lint-allow: read-only 버전 탐지(진단)만, 사용자 빌드 실행 아님
import { promisify } from "node:util";

const execP = promisify(exec);

export async function runServer(): Promise<void> {
  const server = new Server(
    { name: "tg-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "tg_scan",
        description:
          "사용자 컴퓨터의 환경 (OS·셸·런타임·AI 클라이언트) 을 스캔해서 반환합니다. 입문자에게 무엇이 깔려있고 무엇이 부족한지 알 때 호출하세요. 명령을 실행하지는 않습니다.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name } = req.params;

    if (name === "tg_scan") {
      const env = await scan();
      return {
        content: [{ type: "text", text: JSON.stringify(env, null, 2) }],
      };
    }

    return {
      isError: true,
      content: [{ type: "text", text: `알 수 없는 도구: ${name}` }],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function scan(): Promise<Record<string, unknown>> {
  const tools = ["python3", "node", "git"];
  const versions: Record<string, string | null> = {};
  for (const t of tools) {
    try {
      // stance-lint-allow: read-only 버전 탐지(진단), 사용자 빌드 실행 아님
      const { stdout } = await execP(`${t} --version`, { timeout: 3000 });
      versions[t] = stdout.trim();
    } catch {
      versions[t] = null;
    }
  }
  return {
    os: process.platform,
    shell: process.env.SHELL ?? process.env.ComSpec ?? null,
    runtimes: versions,
    home: process.env.HOME ?? process.env.USERPROFILE ?? null,
  };
}

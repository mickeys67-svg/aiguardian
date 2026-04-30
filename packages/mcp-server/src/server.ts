import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { isBlacklisted } from "./safety.js";

const execP = promisify(exec);

const RunCommandInput = z.object({
  command: z.string().min(1).describe("실행할 셸 명령. Safety Net 검증 후 실행됨."),
  cwd: z.string().optional().describe("작업 디렉토리 (기본: 현재)"),
  dryRun: z
    .boolean()
    .optional()
    .describe("true 면 실제 실행하지 않고 명령만 반환"),
});

const DeployInput = z.object({
  projectPath: z.string().describe("배포할 프로젝트 폴더 절대경로"),
  provider: z
    .enum(["cloudflare-pages"])
    .default("cloudflare-pages")
    .describe("v0.1 은 Cloudflare Pages 만 지원"),
});

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
          "사용자 컴퓨터의 환경 (OS·셸·런타임·AI 클라이언트) 을 스캔해서 반환합니다. 입문자에게 무엇이 깔려있고 무엇이 부족한지 알 때 호출하세요.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "tg_run_command",
        description:
          "사용자 컴퓨터에서 셸 명령을 실행합니다. 위험 명령은 Safety Net 이 자동 차단합니다. 입문자에게는 dry-run 부터 권장.",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "실행할 셸 명령 (한 줄).",
            },
            cwd: {
              type: "string",
              description: "작업 디렉토리. 생략 시 현재 디렉토리.",
            },
            dryRun: {
              type: "boolean",
              description: "true 면 명령만 보여주고 실행하지 않음.",
            },
          },
          required: ["command"],
        },
      },
      {
        name: "tg_deploy",
        description:
          "프로젝트 폴더를 Cloudflare Pages 에 배포해서 공개 URL 을 반환합니다. wrangler 가 깔려있어야 합니다.",
        inputSchema: {
          type: "object",
          properties: {
            projectPath: {
              type: "string",
              description: "배포할 프로젝트 폴더 절대경로.",
            },
            provider: {
              type: "string",
              enum: ["cloudflare-pages"],
              description: "배포 제공자 (v0.1 은 cloudflare-pages 만).",
            },
          },
          required: ["projectPath"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    if (name === "tg_scan") {
      const env = await scan();
      return {
        content: [
          { type: "text", text: JSON.stringify(env, null, 2) },
        ],
      };
    }

    if (name === "tg_run_command") {
      const input = RunCommandInput.parse(args);
      if (isBlacklisted(input.command)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "🛑 Safety Net 차단: 이 명령은 시스템을 망가뜨릴 수 있어 실행되지 않았습니다.",
            },
          ],
        };
      }

      if (input.dryRun) {
        return {
          content: [
            {
              type: "text",
              text: `(dry-run) 실행 예정: ${input.command}\n작업 디렉토리: ${input.cwd ?? process.cwd()}`,
            },
          ],
        };
      }

      try {
        const { stdout, stderr } = await execP(input.command, {
          cwd: input.cwd,
          shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
          timeout: 60_000,
          maxBuffer: 4 * 1024 * 1024,
        });
        return {
          content: [
            { type: "text", text: stdout || stderr || "(빈 출력)" },
          ],
        };
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string; message: string };
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `실행 실패:\nstdout: ${e.stdout ?? ""}\nstderr: ${e.stderr ?? ""}\n${e.message}`,
            },
          ],
        };
      }
    }

    if (name === "tg_deploy") {
      const input = DeployInput.parse(args);
      try {
        const { stdout, stderr } = await execP(
          `npx wrangler pages deploy ${JSON.stringify(input.projectPath)}`,
          {
            timeout: 120_000,
            maxBuffer: 4 * 1024 * 1024,
          },
        );
        return {
          content: [
            { type: "text", text: stdout || stderr || "(배포 완료)" },
          ],
        };
      } catch (err) {
        const e = err as { message: string };
        return {
          isError: true,
          content: [{ type: "text", text: `배포 실패: ${e.message}` }],
        };
      }
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

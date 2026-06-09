// 코치 번들러 — .ts 어댑터를 "plain node 로 실행되는 자립형 .mjs" 로 굽는다.
//
// 왜: dev 는 Node 24 타입스트리핑으로 .ts 가 그냥 돌지만, 입문자 PC 는 Node 18/20 일 수
// 있다. 배포본은 타입을 벗기고 의존성(zod·MCP SDK)을 인라인해 node_modules 없이 돌아야 한다.
//   → tg-coach-stop.mjs  : Claude Code Stop 훅 (Tauri 리소스로 번들)
//   → tg-coach-mcp.mjs   : MCP 서버 (.mcpb 로 데스크탑 Claude 에 설치)
//
// 실행: node build.mjs   (= pnpm --filter @tg/coach build)

import { build } from "esbuild";

const common = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  // shebang 없음 — 항상 `node "<path>"`(Stop 훅) 또는 .mcpb command:node 로 실행하므로 불필요.
  // (ESM 은 1행 외 위치의 #! 를 못 벗겨 깨진다.)
  logLevel: "info",
};

const entries = [
  { in: "src/adapters/claude-code/stop-hook.ts", out: "dist/tg-coach-stop.mjs" },
  { in: "src/adapters/mcp/server.ts", out: "dist/tg-coach-mcp.mjs" },
];

for (const e of entries) {
  await build({ ...common, entryPoints: [e.in], outfile: e.out });
}

console.log(`✓ 번들 완료: ${entries.map((e) => e.out).join(", ")}`);

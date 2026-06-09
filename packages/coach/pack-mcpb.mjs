// .mcpb 패키징 — 데스크탑 Claude 가 "설정 → 확장" 클릭으로 설치하는 번들을 만든다.
//
// 산출물: dist/mcpb-stage/  (풀린 확장: manifest.json + server/tg-coach-mcp.mjs)
//         → 여기를 zip 으로 묶고 확장자를 .mcpb 로 바꾸면 끝(manifest.json 이 zip 루트에 와야 함).
//
// 권장 패킹(검증·서명 포함): npx @anthropic-ai/mcpb pack dist/mcpb-stage dist/tg-coach.mcpb
// 오프라인 대안(Windows): Compress-Archive -Path dist/mcpb-stage/* -DestinationPath dist/tg-coach.zip
//                          후 tg-coach.zip → tg-coach.mcpb 로 이름 변경.
//
// 실행: node pack-mcpb.mjs   (= pnpm --filter @tg/coach pack:mcpb)

import { copyFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url)); // packages/coach
const bundle = join(here, "dist", "tg-coach-mcp.mjs");
const manifest = join(here, "mcpb", "manifest.json");

if (!existsSync(bundle)) {
  console.error(
    `✗ MCP 번들이 없습니다: ${bundle}\n  먼저 'pnpm --filter @tg/coach build' 를 실행하세요.`,
  );
  process.exit(1);
}

const stage = join(here, "dist", "mcpb-stage");
const serverDir = join(stage, "server");
rmSync(stage, { recursive: true, force: true });
mkdirSync(serverDir, { recursive: true });

copyFileSync(manifest, join(stage, "manifest.json"));
copyFileSync(bundle, join(serverDir, "tg-coach-mcp.mjs"));

console.log(`✓ 확장 스테이지 준비: ${stage}`);
console.log("  - manifest.json (zip 루트)");
console.log("  - server/tg-coach-mcp.mjs (자립형, node_modules 불필요)");
console.log("\n다음: npx @anthropic-ai/mcpb pack dist/mcpb-stage dist/tg-coach.mcpb");

// 코치 번들을 Tauri 리소스 자리로 복사한다.
//
// 왜: "코치 켜기" 버튼은 resolveResource("coach/tg-coach-stop.mjs")(Stop 훅) 와
// resolveResource("coach/tg-coach-mcp.mjs")(세션 AI가 부르는 coach MCP) 로 스크립트를
// 찾는다. 두 파일이 앱 번들 안에 있어야 버튼이 살아나고 자동 코칭이 켜진다.
// src-tauri 바깥(../../../packages) 을 resources 로 직접 가리키면 일부 Tauri 빌드가
// 거부하므로, src-tauri 내부(resources/coach/)로 복사해 두고 거기를 가리킨다.
//
// 빌드 체인: pnpm --filter @tg/coach build → (이 스크립트) → tsc -b && vite build

import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url)); // apps/desktop/scripts
const desktop = dirname(here); // apps/desktop
const repoRoot = join(desktop, "..", ".."); // E:/aiguardian

const distDir = join(repoRoot, "packages", "coach", "dist");
const destDir = join(desktop, "src-tauri", "resources", "coach");
// Stop 훅(능동·사실층) + MCP 서버(세션 AI 도출층) 둘 다 — tauri.conf.json resources 와 일치.
const BUNDLES = ["tg-coach-stop.mjs", "tg-coach-mcp.mjs"];

mkdirSync(destDir, { recursive: true });
for (const name of BUNDLES) {
  const src = join(distDir, name);
  if (!existsSync(src)) {
    console.error(
      `✗ 코치 번들이 없습니다: ${src}\n  먼저 'pnpm --filter @tg/coach build' 를 실행하세요.`,
    );
    process.exit(1);
  }
  copyFileSync(src, join(destDir, name));
  console.log(`✓ 코치 리소스 복사: ${join(destDir, name)}`);
}

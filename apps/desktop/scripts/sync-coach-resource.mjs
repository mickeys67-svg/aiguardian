// 코치 번들을 Tauri 리소스 자리로 복사한다.
//
// 왜: "코치 켜기" 버튼은 resolveResource("coach/tg-coach-stop.mjs") 로 훅 스크립트를
// 찾는다. 그 파일이 앱 번들 안에 있어야 버튼이 살아난다(회색 해제).
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

const src = join(repoRoot, "packages", "coach", "dist", "tg-coach-stop.mjs");
const destDir = join(desktop, "src-tauri", "resources", "coach");
const dest = join(destDir, "tg-coach-stop.mjs");

if (!existsSync(src)) {
  console.error(
    `✗ 코치 번들이 없습니다: ${src}\n  먼저 'pnpm --filter @tg/coach build' 를 실행하세요.`,
  );
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`✓ 코치 훅 리소스 복사: ${dest}`);

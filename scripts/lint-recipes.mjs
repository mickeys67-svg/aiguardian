#!/usr/bin/env node
// 레시피 정합성 검사 — CI / pre-commit 에서 호출.
// 1. recipes/index.json 모든 항목이 verifyKind 보유
// 2. category 와 verifyKind 가 권장 매핑에 부합
// 3. id 가 폴더명과 일치 (예: 01-simple-webpage → recipes/01-simple-webpage/)
// 4. requires 의 도구가 알려진 목록 안

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const INDEX_PATH = resolve(ROOT, "recipes", "index.json");

const VALID_KINDS = ["html", "bot", "cli", "python", "data", "web"];
const VALID_CATEGORIES = ["web", "automation", "bot", "data", "game", "portfolio"];

// 권장 매핑 — category × verifyKind 가 이 표에 들어가야 권장.
const RECOMMENDED = {
  // QR 생성·이미지 생성처럼 web 카테고리지만 결과물이 파일인 경우도 허용.
  web: ["html", "web", "data"],
  automation: ["cli", "python", "data"],
  bot: ["bot", "cli"],
  data: ["data", "python", "web"],
  game: ["html", "web"],
  portfolio: ["web", "html"],
};

const KNOWN_TOOLS = new Set([
  "node",
  "git",
  "npm",
  "pnpm",
  "python3",
  "python",
  "claude_code",
  "claude_desktop",
  "cursor",
  "wrangler",
]);

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

if (!existsSync(INDEX_PATH)) {
  fail(`레시피 인덱스 없음: ${INDEX_PATH}`);
  process.exit(1);
}

const recipes = JSON.parse(readFileSync(INDEX_PATH, "utf8"));
if (!Array.isArray(recipes)) {
  fail("recipes/index.json 이 배열이 아님");
  process.exit(1);
}

console.log(`\n📋 레시피 ${recipes.length}개 검사 중...\n`);

const ids = new Set();
let warnCount = 0;

for (const r of recipes) {
  const tag = `[${r.id ?? "?"}]`;

  // 1. 필수 필드.
  for (const f of ["id", "title", "category", "difficulty", "estMinutes", "promptTemplate", "steps"]) {
    if (r[f] === undefined || r[f] === null) {
      fail(`${tag} 필수 필드 누락: ${f}`);
    }
  }

  // 2. id 중복.
  if (ids.has(r.id)) fail(`${tag} id 중복`);
  ids.add(r.id);

  // 3. category 유효.
  if (!VALID_CATEGORIES.includes(r.category)) {
    fail(`${tag} 알 수 없는 category: ${r.category}`);
  }

  // 4. verifyKind 필수 + 유효.
  if (!r.verifyKind) {
    fail(`${tag} verifyKind 누락 — html/bot/cli/python/data/web 중 하나 지정`);
  } else if (!VALID_KINDS.includes(r.verifyKind)) {
    fail(`${tag} 알 수 없는 verifyKind: ${r.verifyKind}`);
  }

  // 5. category + verifyKind 권장 매핑.
  if (r.verifyKind && r.category && RECOMMENDED[r.category]) {
    const rec = RECOMMENDED[r.category];
    if (!rec.includes(r.verifyKind)) {
      warn(
        `${tag} category=${r.category} 와 verifyKind=${r.verifyKind} 매핑이 비표준 (권장: ${rec.join(", ")})`,
      );
      warnCount++;
    }
  }

  // 6. requires 도구 검증.
  for (const t of r.requires ?? []) {
    if (!KNOWN_TOOLS.has(t)) {
      warn(`${tag} 알려지지 않은 require: ${t}`);
      warnCount++;
    }
  }

  // 7. steps 1개 이상.
  if (Array.isArray(r.steps) && r.steps.length === 0) {
    fail(`${tag} steps 가 비어있음`);
  }

  // 8. promptTemplate 의 placeholder 일관성.
  const placeholders = (r.promptTemplate ?? "").match(/\{\{(\w+)\}\}/g) ?? [];
  if (placeholders.length > 5) {
    warn(`${tag} placeholder 가 ${placeholders.length}개 — 입문자에겐 부담스러움 (권장 ≤3)`);
    warnCount++;
  }
}

// 9. 폴더 존재 검사.
const recipesDir = resolve(ROOT, "recipes");
const dirs = readdirSync(recipesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const idsArr = recipes.map((r) => r.id);
for (const d of dirs) {
  if (!idsArr.includes(d)) {
    warn(`recipes/${d}/ 폴더 — index.json 에 항목 없음`);
    warnCount++;
  }
}

// 10. 통계 요약.
console.log("\n📊 통계:");
const byKind = {};
const byCategory = {};
for (const r of recipes) {
  byKind[r.verifyKind] = (byKind[r.verifyKind] ?? 0) + 1;
  byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
}
console.log("  verifyKind:", byKind);
console.log("  category:", byCategory);

const errCount = process.exitCode === 1 ? "있음" : "0";
console.log(`\n결과: 에러 ${errCount}, 경고 ${warnCount}`);
if (process.exitCode !== 1) ok("모든 레시피 정합성 검사 통과");

#!/usr/bin/env node
// mock-scan — 가짜·강제·과도한 목업 탐지기. (ADR-0004 후속 4)
//
// 찾는 것:
//   가짜  = 작동하는 척하는 stub (동일 분기 삼항, 빈 핸들러)
//   강제  = 하드코딩·억지 분기 (forced-first index, 미래 stub)
//   목업  = 형태만 있는 placeholder UI / echo-only 레시피 단계
//
// 사용: node scripts/mock-scan.mjs [--strict]
// 면제: 줄 끝에 `// mock-scan-allow: 이유`.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { walk, scanFiles, report } from "./lib/scan.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const roots = ["apps", "packages", "services", "recipes"].map((d) => join(repoRoot, d));

const RULES = [
  {
    id: "identical-ternary",
    severity: "high",
    re: /\?\s*(["'`][^"'`]*["'`])\s*:\s*\1/,
    message: "삼항의 두 분기가 동일 — 작동하는 척하는 가짜(예: ? \"\" : \"\")",
  },
  {
    id: "empty-handler",
    severity: "mid",
    exts: [".ts", ".tsx", ".js"],
    re: /\(\s*\)\s*=>\s*\{\s*\}/,
    message: "빈 핸들러 — 눌러도 아무 일 안 일어남",
  },
  {
    id: "forced-first",
    severity: "mid",
    exts: [".ts", ".tsx", ".js"],
    re: /\?\.\[0\]/,
    message: "동적 자리에 첫 항목 강제(?.[0]) — 사용자 선택이 무시될 수 있음",
  },
  {
    id: "future-stub",
    severity: "mid",
    skipComments: false,
    // TODO/FIXME/TBD 는 대문자 관례라 대소문자 구분(폴더명 "todo" 오탐 방지).
    re: /\bTODO\b|\bFIXME\b|\bTBD\b|<your-|REPLACE_ME|v1\.0\s*부터|v2\.0|준비\s*중|[Cc]oming\s+[Ss]oon/,
    message: "미래 stub/플레이스홀더 — 지금은 비어있는 약속",
  },
  {
    id: "placeholder-ui",
    severity: "mid",
    exts: [".tsx"],
    skipComments: false,
    re: /아직.*없어요|진행 중 프로젝트|에서 도착|곧 만나요/,
    message: "형태만 있는 placeholder UI — 실제 데이터/로직 없음",
  },
  {
    id: "echo-only-step",
    severity: "low",
    exts: [".json"],
    re: /"(windows)?[Cc]ommand":\s*"echo /,
    message: "레시피 단계가 echo 안내문뿐 — 실제 동작 없는 반쪽 실행",
  },
];

const ruleHelp = Object.fromEntries(RULES.map((r) => [r.id, r.message]));
const strict = process.argv.includes("--strict");

const files = walk(roots, [".ts", ".tsx", ".js", ".rs", ".json"]);
const findings = scanFiles(files, RULES, { repoRoot, allowTag: "mock-scan-allow" });
const code = report(findings, { title: "🔍 mock-scan — 가짜·강제·목업 탐지", ruleHelp, strict });
process.exit(code);

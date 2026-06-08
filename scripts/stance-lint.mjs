#!/usr/bin/env node
// stance-lint — "app-as-executor 회귀"를 잡는 가드레일. (ADR-0004)
//
// 우리 스탠스 = "user-runs, app-coaches". 앱이 명령을 대신 실행하거나, 터미널을
// 숨기거나, 안심만 시키거나, 코치가 AI를 떠밀면 안 된다. 그 신호를 찾아 보고한다.
//
// 사용: node scripts/stance-lint.mjs [--strict]
// 면제: 정당한 실행 지점엔 줄 끝에 `// stance-lint-allow: 이유` 를 단다.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { walk, scanFiles, report } from "./lib/scan.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const roots = ["apps", "packages", "services"].map((d) => join(repoRoot, d));

const RULES = [
  {
    id: "silent-install",
    severity: "high",
    re: /--silent\b/,
    message: "설치/명령을 조용히 숨겨 실행 — 입문자가 무슨 일인지 못 봄",
  },
  {
    id: "rust-app-executes",
    severity: "high",
    exts: [".rs"],
    re: /Command::new\(|\.spawn\(\)/,
    message: "앱이 명령을 대신 실행(app-as-executor) — 사용자가 직접 실행하도록 코치할 것",
  },
  {
    id: "ts-app-executes",
    severity: "high",
    exts: [".ts", ".tsx", ".js"],
    re: /\bexecP?\(|\bchild_process\b|\bspawn\(/,
    message: "앱/서버가 셸 명령을 대신 실행 — 코치는 명령을 보여주고 사용자가 실행",
  },
  {
    id: "direct-shell",
    severity: "high",
    re: /\/bin\/sh|cmd\s*\/S\s*\/C|cmd\.exe/,
    message: "셸을 직접 띄움 — 터미널을 숨기지 말고 사용자에게 노출",
  },
  {
    id: "reassurance-copy",
    severity: "mid",
    re: /안전해요|걱정\s*마세요|자동으로\s*(물어|처리|해)/,
    message: "가르치는 대신 안심시켜 클릭 유도 — 무엇을·왜를 설명할 것",
  },
  {
    id: "ai-push",
    severity: "high",
    exts: [".ts", ".tsx", ".js"],
    // Claude Code: additionalContext/decision:block / Cursor: agent_message/followup_message
    re: /additionalContext|decision\s*[:=]\s*["']block["']|agent_message|followup_message/,
    message: "코치가 AI를 떠밂 — 조언은 사람에게만(systemMessage/user_message)",
  },
  {
    id: "ui-run-button",
    severity: "mid",
    exts: [".tsx"],
    re: /runRecipeStep\(|installTool\(/,
    message: "UI가 명령을 실행 — '실행' 버튼 금지, '복사' 버튼만",
  },
];

const ruleHelp = Object.fromEntries(RULES.map((r) => [r.id, r.message]));
const strict = process.argv.includes("--strict");

const files = walk(roots, [".rs", ".ts", ".tsx", ".js"]);
const findings = scanFiles(files, RULES, { repoRoot, allowTag: "stance-lint-allow" });
const code = report(findings, { title: "🧭 stance-lint — 스탠스 회귀 검사", ruleHelp, strict });

console.log(
  "\n참고: 현재 데스크톱 앱(apps/desktop)의 위반은 ADR-0004 리팩터 대상으로 이미 알려진 것입니다.",
);
process.exit(code);

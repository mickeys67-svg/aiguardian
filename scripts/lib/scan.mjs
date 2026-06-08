// 공용 소스 스캐너 — stance-lint / mock-scan 이 함께 쓰는 작은 도구.
// 의존성 없음(Node 표준만). 줄 단위 정규식 규칙으로 코드베이스를 훑는다.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const SKIP_DIRS = new Set([
  "node_modules", "dist", "build", "target", ".git", ".turbo",
  ".next", "coverage", ".claude", "out",
]);

/** roots(절대경로) 아래에서 exts 확장자 파일을 모두 모은다. */
export function walk(roots, exts) {
  const files = [];
  const extSet = new Set(exts);
  const visit = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".github") {
        if (SKIP_DIRS.has(e.name)) continue;
      }
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        visit(full);
      } else if (extSet.has(extname(e.name))) {
        files.push(full);
      }
    }
  };
  for (const r of roots) {
    try {
      if (statSync(r).isDirectory()) visit(r);
    } catch {
      /* 없는 root 는 무시 */
    }
  }
  return files;
}

/** 줄이 주석으로 보이는가(대략). */
function looksComment(line) {
  const t = line.trim();
  return (
    t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") ||
    t.startsWith("#") || t.startsWith("<!--")
  );
}

/**
 * 규칙으로 파일들을 스캔.
 * rule = { id, severity, re, message, exts?, skipComments=true, allowTag }
 * allowTag 가 든 줄(예: "stance-lint-allow")은 건너뜀.
 * 반환: [{ rule, severity, file(rel), line, text }]
 */
export function scanFiles(files, rules, { repoRoot, allowTag }) {
  const findings = [];
  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const rel = relative(repoRoot, file).replace(/\\/g, "/");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (allowTag && line.includes(allowTag)) continue;
      const isComment = looksComment(line);
      for (const rule of rules) {
        if (rule.exts && !rule.exts.includes(extname(file))) continue;
        if (rule.skipComments !== false && isComment) continue;
        rule.re.lastIndex = 0;
        if (rule.re.test(line)) {
          findings.push({
            rule: rule.id,
            severity: rule.severity,
            file: rel,
            line: i + 1,
            text: line.trim().slice(0, 120),
          });
        }
      }
    }
  }
  return findings;
}

const ICON = { high: "🔴", mid: "🟡", low: "🟢" };

/** 콘솔 리포트. strict 면 high/mid 발견 시 종료코드 1. */
export function report(findings, { title, ruleHelp = {}, strict = false }) {
  console.log(`\n${"═".repeat(64)}\n${title}\n${"═".repeat(64)}`);
  if (!findings.length) {
    console.log("✅ 발견 없음.");
    return 0;
  }
  const byRule = new Map();
  for (const f of findings) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, []);
    byRule.get(f.rule).push(f);
  }
  for (const [rule, items] of byRule) {
    const sev = items[0].severity;
    console.log(`\n${ICON[sev] ?? "•"} [${rule}] ${ruleHelp[rule] ?? ""} — ${items.length}건`);
    for (const f of items) {
      console.log(`   ${f.file}:${f.line}  ${f.text}`);
    }
  }
  const blocking = findings.filter((f) => f.severity === "high" || f.severity === "mid").length;
  console.log(`\n총 ${findings.length}건 (차단대상 ${blocking}건).`);
  if (strict && blocking > 0) {
    console.log("strict 모드 — 차단대상이 있어 실패(exit 1).");
    return 1;
  }
  return 0;
}

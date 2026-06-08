// 공용 transcript 파서 — Anthropic식 content-block JSONL.
//
// Claude Code·Cursor 등 여러 클라이언트가 같은 모양(message.content 안에 tool_use/
// tool_result 블록)을 쓴다. 그 공통 부분을 여기서 흡수해 코어 입력(TurnSummary)으로
// 정규화한다. 클라마다 다른 부분(출력 필드·진입점)은 각 어댑터가 처리한다.
//
// ⚠️ 클라이언트의 실제 JSONL 포맷이 다르면 이 파서를 클라별로 분기/교체해야 한다.

import type { TurnSummary, FileChange, CommandRun } from "../core/types.ts";

interface NormalEntry {
  role: "user" | "assistant" | "other";
  blocks: ContentBlock[];
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id?: string; name?: string; input?: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id?: string; is_error?: boolean; content?: unknown }
  | { type: string; [k: string]: unknown };

/** transcript JSONL → 정규화된 엔트리 배열. 깨진 줄은 건너뜀. */
export function parseTranscript(jsonl: string): NormalEntry[] {
  const out: NormalEntry[] = [];
  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const message = (obj.message ?? obj) as Record<string, unknown>;
    const rawRole = (obj.type ?? message.role) as string | undefined;
    const role: NormalEntry["role"] =
      rawRole === "user" || rawRole === "assistant" ? rawRole : "other";

    const rawContent = message.content;
    let blocks: ContentBlock[];
    if (typeof rawContent === "string") {
      blocks = [{ type: "text", text: rawContent }];
    } else if (Array.isArray(rawContent)) {
      blocks = rawContent as ContentBlock[];
    } else {
      blocks = [];
    }
    out.push({ role, blocks });
  }
  return out;
}

/** 엔트리가 "진짜 사용자 프롬프트"인가 (tool_result만 든 user 줄은 제외). */
function isRealUserPrompt(e: NormalEntry): boolean {
  if (e.role !== "user") return false;
  return e.blocks.some((b) => b.type === "text" && (b as { text: string }).text.trim());
}

/** 엔트리에서 평문 텍스트를 모아 반환. */
function textOf(e: NormalEntry): string {
  return e.blocks
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * 마지막 사용자 프롬프트 이후(= 가장 최근 개발 턴)를 분석해 TurnSummary 반환.
 * 사용자 프롬프트가 없으면 null.
 */
export function summarizeLastTurn(jsonl: string): TurnSummary | null {
  const entries = parseTranscript(jsonl);

  let turnStart = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (isRealUserPrompt(entries[i]!)) {
      turnStart = i;
      break;
    }
  }
  if (turnStart < 0) return null;

  const turn = entries.slice(turnStart);
  const userPrompt = textOf(turn[0]!);

  const filesChanged: FileChange[] = [];
  const commandsRun: CommandRun[] = [];
  let lastAssistantText = "";
  let hadError = false;

  // tool_use id → commandsRun index (tool_result is_error 매칭용).
  const bashById = new Map<string, number>();

  for (const e of turn) {
    for (const b of e.blocks) {
      if (b.type === "tool_use") {
        const tu = b as { id?: string; name?: string; input?: Record<string, unknown> };
        const name = tu.name ?? "";
        const input = tu.input ?? {};
        if (name === "Bash") {
          const command = String(input.command ?? "").trim();
          if (command) {
            const idx = commandsRun.push({ command, failed: false }) - 1;
            if (tu.id) bashById.set(tu.id, idx);
          }
        } else if (name === "Write") {
          const path = String(input.file_path ?? input.path ?? "").trim();
          if (path) filesChanged.push({ path, action: "create" });
        } else if (name === "Edit") {
          const path = String(input.file_path ?? input.path ?? "").trim();
          if (path) filesChanged.push({ path, action: "edit" });
        }
      } else if (b.type === "tool_result") {
        const tr = b as { tool_use_id?: string; is_error?: boolean };
        if (tr.is_error) {
          hadError = true;
          const idx = tr.tool_use_id ? bashById.get(tr.tool_use_id) : undefined;
          if (idx !== undefined) commandsRun[idx]!.failed = true;
        }
      }
    }
    if (e.role === "assistant") {
      const t = textOf(e);
      if (t) lastAssistantText = t;
    }
  }

  return {
    userPrompt,
    filesChanged: dedupeFiles(filesChanged),
    commandsRun,
    userMustRun: extractUserCommands(lastAssistantText),
    hadError,
  };
}

function dedupeFiles(files: FileChange[]): FileChange[] {
  const seen = new Map<string, FileChange>();
  for (const f of files) {
    // 같은 파일을 만들고 또 고쳤으면 create 를 우선 표기.
    const prev = seen.get(f.path);
    if (!prev || f.action === "create") seen.set(f.path, f);
  }
  return [...seen.values()];
}

/**
 * AI의 마지막 답변 텍스트에서 "사용자가 직접 실행해야 할 셸 명령"을 추출.
 * - ```블록``` 안의 셸 명령
 * - 백틱 인라인 `npm run dev` 류
 * 휴리스틱이라 완벽하진 않지만, 입문자가 가장 많이 막히는 실행 명령을 잡아낸다.
 */
export function extractUserCommands(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  const shellish =
    /^(npm|pnpm|yarn|npx|node|python3?|pip3?|git|wrangler|cargo|vite|deno|bun)\b/;

  // 1) 코드펜스 블록
  for (const m of text.matchAll(/```[a-zA-Z]*\n([\s\S]*?)```/g)) {
    for (const raw of m[1]!.split("\n")) {
      const line = raw.trim().replace(/^\$\s*/, "");
      if (line && shellish.test(line)) found.add(line);
    }
  }
  // 2) 인라인 백틱
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    const line = m[1]!.trim().replace(/^\$\s*/, "");
    if (shellish.test(line)) found.add(line);
  }
  return [...found];
}

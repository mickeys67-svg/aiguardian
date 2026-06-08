// 조언 엔진 (코어) — TurnSummary 를 입문자용 5버킷 코칭으로 변환. 클라이언트 독립.
//
// 원칙(스탠스, ADR-0004):
//  - 존댓말. 입문자에게 정중하게, 겁주지 않게.
//  - AI를 떠밀지 않는다(이건 사람에게 가는 조언이다).
//  - "대신 해줄게요"가 아니라 "직접 해보세요 + 빈칸을 채워드릴게요".
//  - 내용이 없는 버킷은 만들지 않는다(가짜 채움 금지).

import type { TurnSummary } from "./types.ts";

export interface AdviceBucket {
  icon: string;
  title: string;
  lines: string[];
}

const isWindows = process.platform === "win32";

/** 사용자 OS에 맞는 터미널 이름. */
function terminalName(): string {
  if (isWindows) return "PowerShell";
  if (process.platform === "darwin") return "터미널(Terminal) 앱";
  return "터미널";
}

function fileLabel(action: "create" | "edit"): string {
  return action === "create" ? "새로 만들었어요" : "고쳤어요";
}

/** 파일 경로에서 보기 좋은 이름만 (마지막 segment). */
function baseName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

export function buildAdvice(t: TurnSummary): AdviceBucket[] {
  const buckets: AdviceBucket[] = [];

  // ① 무슨 일이 일어났어요 (recap)
  const recap: string[] = [];
  if (t.filesChanged.length) {
    const created = t.filesChanged.filter((f) => f.action === "create");
    const edited = t.filesChanged.filter((f) => f.action === "edit");
    if (created.length) {
      recap.push(
        `AI가 파일 ${created.length}개를 ${fileLabel("create")}: ` +
          created.map((f) => baseName(f.path)).join(", "),
      );
    }
    if (edited.length) {
      recap.push(
        `AI가 파일 ${edited.length}개를 ${fileLabel("edit")}: ` +
          edited.map((f) => baseName(f.path)).join(", "),
      );
    }
  }
  if (t.commandsRun.length) {
    recap.push(
      `명령 ${t.commandsRun.length}개를 대신 실행했어요` +
        (t.commandsRun.length <= 3
          ? `: ${t.commandsRun.map((c) => c.command).join(" / ")}`
          : "."),
    );
  }
  if (recap.length) {
    buckets.push({ icon: "📦", title: "무슨 일이 일어났어요", lines: recap });
  }

  // ② 지금 확인해 보세요 (verify)
  const verify: string[] = [];
  if (t.hadError) {
    verify.push(
      "중간에 에러가 한 번 있었어요. 터미널에 빨간 글자가 남아 있는지 살펴보세요.",
    );
  }
  if (t.filesChanged.length) {
    verify.push("AI가 만든 파일을 한 번 열어, 의도하신 내용이 맞는지 눈으로 확인해 보세요.");
  }
  if (looksLikeWeb(t)) {
    verify.push(
      "웹 화면을 만드는 작업 같아요. 브라우저에서 페이지가 제대로 뜨는지 확인해 보세요.",
    );
  }
  if (verify.length) {
    buckets.push({ icon: "👀", title: "지금 확인해 보세요", lines: verify });
  }

  // ③ 직접 하셔야 하는 작업 (외부 작업 — 스탠스의 핵심)
  if (t.userMustRun.length) {
    const lines: string[] = [
      "아래 명령은 AI가 대신 못 해요. 직접 입력하셔야 해요:",
      ...t.userMustRun.map((c) => `    ${c}`),
      `${terminalName()}을(를) 열고, 이 프로젝트 폴더 안에서 한 줄씩 실행하세요.`,
    ];
    buckets.push({ icon: "⌨️", title: "직접 하셔야 하는 작업이에요", lines });
  }

  // ④ 초보자가 자주 놓쳐요 (missed)
  const missed: string[] = [];
  if (t.filesChanged.length) {
    missed.push("편집기에서 저장(Ctrl+S)이 됐는지, 그리고 git에 커밋을 했는지 확인하세요.");
  }
  if (t.commandsRun.some((c) => /npm (install|i)\b|pnpm (install|add)\b/.test(c.command))) {
    missed.push(
      "설치가 끝나면 node_modules 폴더가 생겨요. 용량이 커도 정상이고, git에 올리지 않아도 돼요.",
    );
  }
  if (missed.length) {
    buckets.push({ icon: "💡", title: "초보자가 자주 놓쳐요", lines: missed });
  }

  // ⑤ 다음엔 이렇게 (direction)
  const next: string[] = [];
  if (t.hadError) {
    next.push(
      "에러가 있었다면, 다음 프롬프트로 그 에러 메시지를 그대로 붙여넣고 \"이 에러 고쳐줘\"라고 해보세요.",
    );
  } else {
    next.push(
      "한 번에 크게 바꾸기보다, 작은 단위로 요청하면 따라가기 쉬워요. 예: \"방금 만든 화면에 버튼 하나만 추가해줘\".",
    );
  }
  buckets.push({ icon: "➡️", title: "다음엔 이렇게 해보세요", lines: next });

  return buckets;
}

/** 웹 관련 작업인지 대략 판단(파일 확장자·명령으로). */
function looksLikeWeb(t: TurnSummary): boolean {
  const webFile = t.filesChanged.some((f) => /\.(html|css|jsx?|tsx?|vue|svelte)$/i.test(f.path));
  const webCmd = [...t.commandsRun.map((c) => c.command), ...t.userMustRun].some((c) =>
    /vite|next|npm run dev|pnpm dev|react|serve/i.test(c),
  );
  return webFile || webCmd;
}

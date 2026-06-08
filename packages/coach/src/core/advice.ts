// 조언 엔진 (코어) — TurnSummary 를 입문자용 5버킷 코칭으로 변환. 클라이언트 독립.
//
// 원칙(스탠스, ADR-0004):
//  - 존댓말. 입문자에게 정중하게, 겁주지 않게.
//  - AI를 떠밀지 않는다(이건 사람에게 가는 조언이다).
//  - "대신 해줄게요"가 아니라 "직접 해보세요 + 빈칸을 채워드릴게요".
//  - 내용이 없는 버킷은 만들지 않는다(가짜 채움 금지).
//
// 출력은 구조화(AdviceItem)라 터미널·마크다운·HUD 가 같은 데이터를 쓴다.
// 브라우저(HUD)에서도 돌도록 process 직접 접근을 피하고 OS 는 인자/안전 감지로 받는다.

import type { AdviceBucket, AdviceItem, TurnSummary } from "./types.ts";

export type { AdviceBucket, AdviceItem } from "./types.ts";

export type Os = "windows" | "macos" | "linux";
export interface AdviceOptions {
  /** 미지정 시 런타임에서 안전하게 감지(브라우저면 windows 기본). */
  os?: Os;
}

/** process 가 없는 환경(브라우저)에서도 안전하게 OS 감지. */
function detectOs(): Os {
  const p = (globalThis as { process?: { platform?: string } }).process?.platform;
  if (p === "win32") return "windows";
  if (p === "darwin") return "macos";
  if (p === "linux") return "linux";
  return "windows"; // 브라우저 등 미상 → 한국 사용자 다수 기준 기본값
}

function terminalName(os: Os): string {
  if (os === "windows") return "PowerShell";
  if (os === "macos") return "터미널(Terminal) 앱";
  return "터미널";
}

function fileLabel(action: "create" | "edit"): string {
  return action === "create" ? "새로 만들었어요" : "고쳤어요";
}

/** 파일 경로에서 보기 좋은 이름만 (마지막 segment). */
function baseName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

const text = (t: string): AdviceItem => ({ kind: "text", text: t });
const cmd = (c: string): AdviceItem => ({ kind: "command", command: c });

export function buildAdvice(t: TurnSummary, opts: AdviceOptions = {}): AdviceBucket[] {
  const os = opts.os ?? detectOs();
  const buckets: AdviceBucket[] = [];

  // ① 무슨 일이 일어났어요 (recap)
  const recap: AdviceItem[] = [];
  if (t.filesChanged.length) {
    const created = t.filesChanged.filter((f) => f.action === "create");
    const edited = t.filesChanged.filter((f) => f.action === "edit");
    if (created.length) {
      recap.push(
        text(
          `AI가 파일 ${created.length}개를 ${fileLabel("create")}: ` +
            created.map((f) => baseName(f.path)).join(", "),
        ),
      );
    }
    if (edited.length) {
      recap.push(
        text(
          `AI가 파일 ${edited.length}개를 ${fileLabel("edit")}: ` +
            edited.map((f) => baseName(f.path)).join(", "),
        ),
      );
    }
  }
  if (t.commandsRun.length) {
    recap.push(
      text(
        `명령 ${t.commandsRun.length}개를 대신 실행했어요` +
          (t.commandsRun.length <= 3
            ? `: ${t.commandsRun.map((c) => c.command).join(" / ")}`
            : "."),
      ),
    );
  }
  if (recap.length) {
    buckets.push({ key: "recap", icon: "📦", title: "무슨 일이 일어났어요", items: recap });
  }

  // ② 지금 확인해 보세요 (verify)
  const verify: AdviceItem[] = [];
  if (t.hadError) {
    verify.push(text("중간에 에러가 한 번 있었어요. 터미널에 빨간 글자가 남아 있는지 살펴보세요."));
  }
  if (t.filesChanged.length) {
    verify.push(text("AI가 만든 파일을 한 번 열어, 의도하신 내용이 맞는지 눈으로 확인해 보세요."));
  }
  if (looksLikeWeb(t)) {
    verify.push(text("웹 화면을 만드는 작업 같아요. 브라우저에서 페이지가 제대로 뜨는지 확인해 보세요."));
  }
  if (verify.length) {
    buckets.push({ key: "verify", icon: "👀", title: "지금 확인해 보세요", items: verify });
  }

  // ③ 직접 하셔야 하는 작업 (외부 작업 — 스탠스의 핵심). 명령은 command 항목.
  if (t.userMustRun.length) {
    buckets.push({
      key: "do",
      icon: "⌨️",
      title: "직접 하셔야 하는 작업이에요",
      items: [
        text("아래 명령은 AI가 대신 못 해요. 직접 입력하셔야 해요:"),
        ...t.userMustRun.map(cmd),
        text(`${terminalName(os)}을(를) 열고, 이 프로젝트 폴더 안에서 한 줄씩 실행하세요.`),
      ],
    });
  }

  // ④ 초보자가 자주 놓쳐요 (missed)
  const missed: AdviceItem[] = [];
  if (t.filesChanged.length) {
    missed.push(text("편집기에서 저장(Ctrl+S)이 됐는지, 그리고 git에 커밋을 했는지 확인하세요."));
  }
  if (t.commandsRun.some((c) => /npm (install|i)\b|pnpm (install|add)\b/.test(c.command))) {
    missed.push(
      text("설치가 끝나면 node_modules 폴더가 생겨요. 용량이 커도 정상이고, git에 올리지 않아도 돼요."),
    );
  }
  if (missed.length) {
    buckets.push({ key: "missed", icon: "💡", title: "초보자가 자주 놓쳐요", items: missed });
  }

  // ⑤ 다음엔 이렇게 (direction) — 뭔가 일어난 턴에만. 빈 턴(채팅만)이면 조언 없음.
  if (buckets.length > 0) {
    const next: AdviceItem = t.hadError
      ? text('에러가 있었다면, 다음 프롬프트로 그 에러 메시지를 그대로 붙여넣고 "이 에러 고쳐줘"라고 해보세요.')
      : text('한 번에 크게 바꾸기보다, 작은 단위로 요청하면 따라가기 쉬워요. 예: "방금 만든 화면에 버튼 하나만 추가해줘".');
    buckets.push({ key: "next", icon: "➡️", title: "다음엔 이렇게 해보세요", items: [next] });
  }

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

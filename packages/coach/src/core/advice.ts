// 조언 엔진 (코어) — TurnSummary 를 입문자용 코칭 버킷으로 변환. 클라이언트 독립.
//
// 책임 분리(핵심):
//  - 사실 버킷(recap/verify/do/missed/next) = 규칙. 즉시·오프라인·환각 불가·일관됨.
//  - 주관 버킷(encourage/ideas) = 세션 AI가 실제 맥락으로 '도출'해 넘긴다(DerivedAdvice).
//    규칙으로 캔 문구를 찍으면 "뻔하고 늦다" — 진짜 맞춤이려면 모델이 지금 맥락을 봐야 한다.
//    · encourage: 도출분 우선, 없으면 사실 기반 한 줄로 폴백(에러 없이 뭔가 해낸 턴만).
//    · ideas:     도출분만. 규칙 폴백 없음 — 모델이 안 쓰면 버킷이 안 뜬다(가짜 채움 금지).
//
// 원칙(스탠스, ADR-0004):
//  - 존댓말. 입문자에게 정중하게, 겁주지 않게.
//  - AI를 떠밀지 않는다(이건 사람에게 가는 조언이다).
//  - "대신 해줄게요"가 아니라 "직접 해보세요 + 빈칸을 채워드릴게요".
//  - 내용이 없는 버킷은 만들지 않는다(가짜 채움 금지).
//
// 출력은 구조화(AdviceItem)라 터미널·마크다운·HUD 가 같은 데이터를 쓴다.
// 브라우저(HUD)에서도 돌도록 process 직접 접근을 피하고 OS 는 인자/안전 감지로 받는다.

import type { AdviceBucket, AdviceItem, DerivedAdvice, TurnSummary } from "./types.ts";

export type { AdviceBucket, AdviceItem } from "./types.ts";

export type Os = "windows" | "macos" | "linux";
export interface AdviceOptions {
  /** 미지정 시 런타임에서 안전하게 감지(브라우저면 windows 기본). */
  os?: Os;
  /** 세션 AI가 실제 맥락으로 써 넘긴 주관적 코칭(격려·아이디어). 규칙이 못 만드는 부분. */
  derived?: DerivedAdvice;
  /**
   * 코칭 언어(BCP-47, 기본 'ko'). 추측(한글 비율 등) 금지 — 세션 AI가 '선언'한 값을 받는다.
   * 현재 규칙 버킷은 ko 전용(vibemate.kr 스탠스). 이 필드는 ① 도출 경로 언어 계약 ② 상태 stamp 용.
   */
  locale?: string;
}

const MAX_LEN = 140;

/** 한 줄 길이를 안전하게 자른다(HUD·터미널 폭 보호). */
function clip(s: string): string {
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN - 1) + "…" : s;
}

/**
 * 격려는 사람을 향한 한 줄이어야 한다. 모델이 명령을 슬쩍 끼워 "대신 해줄게요"로
 * 변질시키는 걸 차단하고, 비면 null(가짜 채움 금지).
 */
function sanitizeEncouragement(s?: string): string | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  if (/```|^\s*(npm|pnpm|yarn|git|npx|node|cd|rm|curl)\b/im.test(t)) return null;
  return clip(t);
}

/**
 * 아이디어는 '사용자가 AI에게 시킬 말'이어야 한다. 모델이 "제가 ~할게요"로 스탠스를
 * 누수하거나 코드펜스를 넣으면 탈락. 최대 3개, 중복 제거.
 */
function sanitizeIdeas(arr?: string[]): string[] {
  const out: string[] = [];
  for (const raw of arr ?? []) {
    const t = (raw ?? "").trim();
    if (!t || /```/.test(t)) continue;
    // 스탠스 누수 차단: 코칭은 사람을 향한다 — AI가 자기가 하겠다고 쓰면 탈락.
    // ("제가/AI가/내가" + 같은 문장 안 + 약속형 어미). "~해줘"로 끝나는 정상 아이디어는 통과.
    if (/(^|[\s,("'])(제가|AI가|내가)[^.!?\n]*?(할게요|하겠|드릴게요|해드릴게요|해둘게요)/.test(t)) continue;
    // 언어 무관 약속형(영어 세션 fail-open 차단): "I'll / I will / let me / I'm going to / I can add…"
    if (/\b(i['’]?ll|i\s+will|let\s+me|i['’]?m\s+going\s+to|i\s+can\s+(?:add|make|create|build|fix|implement|set\s+up))\b/i.test(t)) continue;
    const c = clip(t);
    if (!out.includes(c)) out.push(c);
    if (out.length === 3) break;
  }
  return out;
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

  // ⓪ 잘 되고 있어요 (encourage) — 에러 없이 뭔가 해낸 턴에만. 격려는 사람을 향한다(가짜 칭찬 금지).
  //    모델이 실제 맥락으로 쓴 격려가 있으면 그걸 쓰고, 없으면 사실 기반 한 줄로 폴백.
  if (!t.hadError && (t.filesChanged.length > 0 || t.commandsRun.length > 0)) {
    const line = sanitizeEncouragement(opts.derived?.encouragement) ?? factualEncouragement(t);
    buckets.push({ key: "encourage", icon: "✅", title: "잘 되고 있어요", items: [text(line)] });
  }

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

  // ⑥ 이렇게도 해볼 수 있어요 (ideas) — 능동적 대안. 세션 AI가 실제 맥락으로 도출한 것만.
  //    규칙 폴백 없음: 모델이 안 쓰면 버킷이 안 뜬다. (캔 문구가 바로 "뻔하고 늦다"의 원인)
  //    에러 턴엔 "더 해보세요"를 얹지 않는다(톤 배려 + 스탠스 안전장치).
  const ideas = t.hadError ? [] : sanitizeIdeas(opts.derived?.ideas).map(text);
  if (ideas.length) {
    buckets.push({ key: "ideas", icon: "🎨", title: "이렇게도 해볼 수 있어요", items: ideas });
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

/** 모델이 격려를 안 줬을 때의 사실 기반 폴백. 근거 있는 한 줄만(과장 금지). */
function factualEncouragement(t: TurnSummary): string {
  const created = t.filesChanged.filter((f) => f.action === "create");
  if (created.length && looksLikeWeb(t)) {
    return "화면을 만드는 파일이 생겼어요. 눈에 보이는 결과물이 나왔네요 — 잘 가고 있어요 👍";
  }
  if (created.length) {
    return `파일 ${created.length}개가 새로 만들어졌고 에러도 없었어요. 순조롭게 진행되고 있어요 👍`;
  }
  if (t.filesChanged.length) {
    return "고친 내용이 에러 없이 적용됐어요. 한 걸음 나아갔어요 👍";
  }
  return "명령이 에러 없이 끝났어요. 잘 진행되고 있어요 👍";
}

/** 웹 관련 작업인지 대략 판단(파일 확장자·명령으로). */
function looksLikeWeb(t: TurnSummary): boolean {
  const webFile = t.filesChanged.some((f) => /\.(html|css|jsx?|tsx?|vue|svelte)$/i.test(f.path));
  const webCmd = [...t.commandsRun.map((c) => c.command), ...t.userMustRun].some((c) =>
    /vite|next|npm run dev|pnpm dev|react|serve/i.test(c),
  );
  return webFile || webCmd;
}

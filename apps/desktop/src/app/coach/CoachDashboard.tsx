// 코치 대시보드 (HUD) — 와이어프레임. (ADR-0004, 옵션 B 대시보드형)
//
// 정체성: 우리는 IDE도 채팅도 터미널도 아니다. "AI 옆에서 흐름을 짚어주는 코치"다.
// 불변식(stance-lint 강제):
//   - 코드 에디터 없음
//   - AI 채팅 입력창 없음
//   - 명령은 "복사" 버튼만, "실행" 버튼 없음 (user-runs, app-coaches)
//
// 지금은 샘플 데이터로 레이아웃만 그린다. 데이터 배선은 다음 단계:
// @tg/coach 코어(능동=Stop 훅 / 수동=MCP)가 만든 5버킷 조언을 이 화면에 흘려보낸다.

import { useState } from "react";

type Step = { id: string; label: string };
const JOURNEY: Step[] = [
  { id: "env", label: "환경 준비" },
  { id: "project", label: "첫 프로젝트" },
  { id: "make", label: "만들기" },
  { id: "verify", label: "실행·확인" },
  { id: "deploy", label: "배포" },
];
const CURRENT_STEP = "make";

type Item = { kind: "text"; text: string } | { kind: "cmd"; cmd: string };
type Bucket = { icon: string; title: string; tone: "info" | "do" | "warn" | "next"; items: Item[] };

// 샘플 — 실제로는 코어의 AdviceBucket 을 받아 채운다.
const SAMPLE: Bucket[] = [
  {
    icon: "📦",
    title: "무슨 일이 일어났어요",
    tone: "info",
    items: [
      { kind: "text", text: "AI가 파일 3개를 새로 만들었어요: index.html, main.js, style.css" },
      { kind: "text", text: "명령 2개를 대신 실행했어요 (프로젝트 생성, 패키지 설치)" },
    ],
  },
  {
    icon: "👀",
    title: "지금 확인해 보세요",
    tone: "info",
    items: [
      { kind: "text", text: "AI가 만든 파일을 한 번 열어, 의도하신 내용이 맞는지 확인해 보세요." },
      { kind: "text", text: "웹 화면 작업이에요. 브라우저에서 페이지가 뜨는지 확인해 보세요." },
    ],
  },
  {
    icon: "⌨️",
    title: "직접 하셔야 하는 작업이에요",
    tone: "do",
    items: [
      { kind: "text", text: "아래 명령은 AI가 대신 못 해요. PowerShell을 열고 이 폴더에서 직접 실행하세요." },
      { kind: "cmd", cmd: "npm run dev" },
    ],
  },
  {
    icon: "💡",
    title: "초보자가 자주 놓쳐요",
    tone: "warn",
    items: [
      { kind: "text", text: "저장(Ctrl+S)이 됐는지, git에 커밋을 했는지 확인하세요." },
      { kind: "text", text: "node_modules 폴더는 용량이 커도 정상이고, git에 올리지 않아도 돼요." },
    ],
  },
  {
    icon: "➡️",
    title: "다음엔 이렇게 해보세요",
    tone: "next",
    items: [
      { kind: "text", text: '작은 단위로 요청하면 따라가기 쉬워요. 예: "방금 만든 화면에 버튼 하나만 추가해줘".' },
    ],
  },
];

const LEARNED = [
  { term: "터미널", done: true },
  { term: "npm install", done: true },
  { term: "dev 서버", done: false },
  { term: "git 커밋", done: false },
];

export function CoachDashboard() {
  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink mb-1">코치</h1>
        <p className="text-sm text-subtle">
          AI 옆에서 흐름을 짚어드려요. 직접 만들지도, 대신 실행하지도 않아요.
        </p>
      </header>

      <JourneyMap />

      <section className="mb-6">
        <h2 className="text-xs font-semibold text-subtle uppercase tracking-wide mb-2 px-1">
          방금 한 턴
        </h2>
        <div className="space-y-3">
          {SAMPLE.map((b) => (
            <BucketCard key={b.title} bucket={b} />
          ))}
        </div>
      </section>

      <LearnedPanel />
    </div>
  );
}

function JourneyMap() {
  const currentIdx = JOURNEY.findIndex((s) => s.id === CURRENT_STEP);
  return (
    <section className="mb-6 rounded-2xl bg-surface border border-subtle/15 p-4">
      <h2 className="text-xs font-semibold text-subtle uppercase tracking-wide mb-3">
        지금 어디쯤이에요
      </h2>
      <ol className="flex items-center gap-2">
        {JOURNEY.map((s, i) => {
          const state = i < currentIdx ? "done" : i === currentIdx ? "now" : "todo";
          return (
            <li key={s.id} className="flex items-center gap-2 flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                    state === "done"
                      ? "bg-success/15 text-success"
                      : state === "now"
                        ? "bg-primary text-white"
                        : "bg-bg text-subtle border border-subtle/20"
                  }`}
                >
                  {state === "done" ? "✓" : i + 1}
                </span>
                <span
                  className={`text-[11px] whitespace-nowrap ${
                    state === "now" ? "text-ink font-medium" : "text-subtle"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < JOURNEY.length - 1 && (
                <span
                  className={`h-px flex-1 ${i < currentIdx ? "bg-success/40" : "bg-subtle/20"}`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const TONE_RING: Record<Bucket["tone"], string> = {
  info: "border-subtle/15",
  do: "border-primary/30",
  warn: "border-warning/40",
  next: "border-subtle/15",
};

function BucketCard({ bucket }: { bucket: Bucket }) {
  return (
    <div className={`rounded-2xl bg-surface border p-4 ${TONE_RING[bucket.tone]}`}>
      <h3 className="text-sm font-semibold text-ink mb-2">
        <span aria-hidden className="mr-1.5">
          {bucket.icon}
        </span>
        {bucket.title}
      </h3>
      <ul className="space-y-1.5">
        {bucket.items.map((item, i) =>
          item.kind === "text" ? (
            <li key={i} className="text-sm text-subtle leading-relaxed">
              {item.text}
            </li>
          ) : (
            <li key={i}>
              <CommandRow cmd={item.cmd} />
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

// 명령은 "복사"만. 실행 버튼은 만들지 않는다 (스탠스 불변식).
function CommandRow({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 불가 시 조용히 무시 */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-bg border border-subtle/15 px-3 py-2">
      <code className="text-[13px] font-mono text-ink truncate">{cmd}</code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition"
      >
        {copied ? "복사됨 ✓" : "복사"}
      </button>
    </div>
  );
}

function LearnedPanel() {
  const done = LEARNED.filter((l) => l.done).length;
  return (
    <section className="mb-6">
      <h2 className="text-xs font-semibold text-subtle uppercase tracking-wide mb-2 px-1">
        배운 것 ({done}/{LEARNED.length})
      </h2>
      <div className="rounded-2xl bg-surface border border-subtle/15 p-4 flex flex-wrap gap-2">
        {LEARNED.map((l) => (
          <span
            key={l.term}
            className={`text-xs px-2.5 py-1 rounded-full ${
              l.done
                ? "bg-success/15 text-success"
                : "bg-bg text-subtle border border-subtle/20"
            }`}
          >
            {l.done ? "✓ " : ""}
            {l.term}
          </span>
        ))}
      </div>
    </section>
  );
}

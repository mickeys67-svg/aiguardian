// 코치 대시보드 (HUD). (ADR-0004, 옵션 B 대시보드형)
//
// 정체성: 우리는 IDE도 채팅도 터미널도 아니다. "AI 옆에서 흐름을 짚어주는 코치"다.
// 불변식(stance-lint 강제): 코드 에디터 없음 · AI 채팅 입력창 없음 ·
//   명령은 "복사" 버튼만, "실행" 버튼 없음 (user-runs, app-coaches).
//
// 데이터: @tg/coach 코어의 buildAdvice() 가 만든 구조화 조언을 그대로 렌더한다.
// 지금은 샘플 TurnSummary 로 엔진을 돌린다. 다음 단계: Stop 훅/MCP 가 보낸 실제 턴으로 교체.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { homeDir } from "@tauri-apps/api/path";
import { buildAdvice } from "@tg/coach/core";
import type { AdviceBucket, AdviceKey, TurnSummary } from "@tg/coach/core";
import { useEnvironment } from "@/lib/hooks";
import { readFile } from "@/lib/tauri";
import { CoachConnect } from "./CoachConnect";

interface CoachState {
  updatedAt: string;
  source: string;
  buckets: AdviceBucket[];
}

// 능동 어댑터(Stop/Cursor 훅)가 쓴 상태 파일을 읽는다. 없으면 null → 예시로 폴백.
async function readCoachState(): Promise<CoachState | null> {
  try {
    const home = (await homeDir()).replace(/[\\/]+$/, "");
    const raw = await readFile(`${home}/.tg-coach/latest-turn.json`);
    return JSON.parse(raw) as CoachState;
  } catch {
    return null;
  }
}

type Step = { id: string; label: string };
const JOURNEY: Step[] = [
  { id: "env", label: "환경 준비" },
  { id: "project", label: "첫 프로젝트" },
  { id: "make", label: "만들기" },
  { id: "verify", label: "실행·확인" },
  { id: "deploy", label: "배포" },
];
const CURRENT_STEP = "make";

// 샘플 턴 — 실제로는 Stop 훅/MCP 어댑터가 보낸 TurnSummary 로 교체된다.
const SAMPLE_TURN: TurnSummary = {
  userPrompt: "할 일 목록 웹페이지를 만들어줘",
  filesChanged: [
    { path: "todo/index.html", action: "create" },
    { path: "todo/main.js", action: "create" },
    { path: "todo/style.css", action: "create" },
  ],
  commandsRun: [{ command: "cd todo && npm install", failed: false }],
  userMustRun: ["npm run dev"],
  hadError: false,
};

const LEARNED = [
  { term: "터미널", done: true },
  { term: "npm install", done: true },
  { term: "dev 서버", done: false },
  { term: "git 커밋", done: false },
];

export function CoachDashboard() {
  const { data: env } = useEnvironment();
  // 훅이 보낸 라이브 조언을 2초마다 폴링. 있으면 그걸, 없으면 예시 엔진 출력.
  const { data: live } = useQuery({
    queryKey: ["coach-state"],
    queryFn: readCoachState,
    refetchInterval: 2000,
  });

  const isLive = !!live;
  const buckets = live?.buckets ?? buildAdvice(SAMPLE_TURN, { os: env?.os ?? "windows" });

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink mb-1">코치</h1>
        <p className="text-sm text-subtle">
          AI 옆에서 흐름을 짚어드려요. 직접 만들지도, 대신 실행하지도 않아요.
        </p>
      </header>

      <CoachConnect />

      <JourneyMap />

      <section className="mb-6">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-semibold text-subtle uppercase tracking-wide">
            방금 한 턴
          </h2>
          {isLive ? (
            <span className="text-[11px] text-success">🟢 라이브 · {live!.source}</span>
          ) : (
            <span className="text-[11px] text-subtle">예시 (아직 받은 턴 없음)</span>
          )}
        </div>
        <div className="space-y-3">
          {buckets.map((b) => (
            <BucketCard key={b.key} bucket={b} />
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

const TONE_RING: Record<AdviceKey, string> = {
  recap: "border-subtle/15",
  verify: "border-subtle/15",
  do: "border-primary/30",
  missed: "border-warning/40",
  next: "border-subtle/15",
};

function BucketCard({ bucket }: { bucket: AdviceBucket }) {
  return (
    <div className={`rounded-2xl bg-surface border p-4 ${TONE_RING[bucket.key]}`}>
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
              <CommandRow cmd={item.command} />
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

// 코치 대시보드 (HUD). (ADR-0004, 옵션 B 대시보드형)
//
// 정체성: 우리는 IDE도 채팅도 터미널도 아니다. "AI 옆에서 흐름을 짚어주는 코치"다.
// 불변식(stance-lint 강제): 코드 에디터 없음 · AI 채팅 입력창 없음 ·
//   명령은 "복사" 버튼만, "실행" 버튼 없음 (user-runs, app-coaches).
//
// 데이터는 '실제'만 보여준다 — 능동 어댑터(Stop 훅)·MCP(coach_review)가 쓴 상태 파일.
// 받은 턴이 없으면 가짜 예시를 띄우지 않고 정직한 빈 상태를 보인다(가짜 채움 금지, mock-scan).

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { homeDir } from "@tauri-apps/api/path";
import type { AdviceBucket, AdviceKey, CoachState } from "@tg/coach/core";
import { readFile } from "@/lib/tauri";
import { CoachConnect } from "./CoachConnect";

// 능동 어댑터(Stop/Cursor 훅)·MCP 가 쓴 상태 파일을 읽는다. 없으면 null → 빈 상태.
async function readCoachState(): Promise<CoachState | null> {
  try {
    const home = (await homeDir()).replace(/[\\/]+$/, "");
    const raw = await readFile(`${home}/.tg-coach/latest-turn.json`);
    const state = JSON.parse(raw) as CoachState;
    return state.buckets?.length ? state : null; // 빈 buckets 는 받은 턴 없음으로 취급
  } catch {
    return null;
  }
}

export function CoachDashboard() {
  // 훅/MCP 가 보낸 라이브 조언을 2초마다 폴링. 실제 턴이 없으면 빈 상태.
  const { data: live } = useQuery({
    queryKey: ["coach-state"],
    queryFn: readCoachState,
    refetchInterval: 2000,
  });

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink mb-1">코치</h1>
        <p className="text-sm text-subtle">
          AI 옆에서 흐름을 짚어드려요. 직접 만들지도, 대신 실행하지도 않아요.
        </p>
      </header>

      <CoachConnect />

      <section className="mb-6">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-semibold text-subtle uppercase tracking-wide">방금 한 턴</h2>
          {live && (
            <span className="text-[11px] text-success">
              🟢 라이브 · {live.phase === "enriched" ? "맞춤 코칭" : "사실 정리"}
            </span>
          )}
        </div>

        {live ? (
          <div className="space-y-3">
            {live.buckets.map((b) => (
              <BucketCard key={b.key} bucket={b} />
            ))}
          </div>
        ) : (
          <EmptyTurn />
        )}
      </section>
    </div>
  );
}

// 받은 턴이 없을 때 — 가짜 예시 대신 다음 행동을 정직하게 안내.
function EmptyTurn() {
  return (
    <div className="rounded-2xl bg-surface border border-subtle/15 p-6 text-center">
      <p className="text-sm text-ink mb-1">아직 짚어드릴 턴이 없어요.</p>
      <p className="text-xs text-subtle">
        위에서 코치를 켜고, 쓰시는 AI에게 한 가지를 만들어 달라고 해보세요. 한 턴이 끝나면 여기서 짚어드릴게요.
      </p>
    </div>
  );
}

const TONE_RING: Record<AdviceKey, string> = {
  encourage: "border-success/40",
  recap: "border-subtle/15",
  verify: "border-subtle/15",
  do: "border-primary/30",
  missed: "border-warning/40",
  ideas: "border-primary/30",
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

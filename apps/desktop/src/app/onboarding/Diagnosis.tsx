import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useEnvironment } from "@/lib/hooks";
import { useOnboarding } from "../state";
import { useQueryClient } from "@tanstack/react-query";
import { AutoTerm } from "../components/AutoTerm";
import { TerminalCheatsheet } from "../components/TerminalCheatsheet";
import {
  shouldShowCheatsheet,
  markCheatsheetSeen,
  dismissCheatsheetForever,
} from "@/lib/cheatsheet";

const STEPS = [
  "터미널 환경 확인 중...",
  "Python · Node · Git 확인 중...",
  "패키지 매니저 확인 중...",
  "AI 도구 (Claude · Cursor) 확인 중...",
  "결과 정리 중...",
];

export function Diagnosis() {
  const { data, isLoading, isError, error, refetch } = useEnvironment();
  const next = useOnboarding((s) => s.next);
  const qc = useQueryClient();
  const [stepIdx, setStepIdx] = useState(0);
  // 진단 시작과 동시에 단축키 치트시트 살짝 띄움 — 사용자가 기다리는 시간에 학습.
  // 이미 본 적 있거나 3회 dismiss 했으면 OFF.
  const [cheatsheetOpen, setCheatsheetOpen] = useState(shouldShowCheatsheet);

  // 로딩 안 거치고 캐시 hit 으로 즉시 도착해도 진행 표시는 빠르게 한 번 쓸어줌.
  useEffect(() => {
    if (!isLoading && data) {
      // 캐시 즉시 hit — 단계 표시 빠르게 다 채우기.
      setStepIdx(STEPS.length - 1);
      return;
    }
    if (!isLoading) return;
    const id = window.setInterval(() => {
      setStepIdx((i) => (i + 1 < STEPS.length ? i + 1 : i));
    }, 600);
    return () => window.clearInterval(id);
  }, [isLoading, data]);

  // 15초 넘게 걸리면 "오래 걸리네요" 안내 — 사용자가 멈춘 줄 알고 종료하는 걸 차단.
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setStalled(false);
      return;
    }
    const t = window.setTimeout(() => setStalled(true), 15000);
    return () => window.clearTimeout(t);
  }, [isLoading]);

  // 자동 next + skip 버튼 race 방어 — guardRef.
  const advancedRef = useRef(false);
  useEffect(() => {
    if (data && !isLoading && !advancedRef.current) {
      const t = window.setTimeout(() => {
        if (advancedRef.current) return;
        advancedRef.current = true;
        next();
      }, 700);
      return () => window.clearTimeout(t);
    }
  }, [data, isLoading, next]);

  const handleRetry = async () => {
    advancedRef.current = false;
    setStepIdx(0);
    await qc.invalidateQueries({ queryKey: ["environment"] });
    await refetch();
  };

  const setStage = useOnboarding((s) => s.setStage);
  const handleSkip = () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    // Result !data 분기를 우회 — Goal 로 바로 점프해서 사용자가 의사결정을 두 번 하지 않게.
    setStage("goal");
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-md w-full px-6 text-center"
    >
      <div className="text-5xl mb-6" aria-hidden>
        🔍
      </div>
      <h2 className="text-2xl font-semibold text-ink mb-3">
        잠깐만요, 컴퓨터 둘러보는 중이에요
      </h2>
      <p className="text-subtle mb-8 text-sm">
        파일 내용은 절대 안 봐요. 어떤 도구가 깔려있는지만 확인해요.
      </p>

      {!isError && (
        <>
          <div
            className="h-1.5 w-full bg-surface rounded-full overflow-hidden mb-6"
            role="progressbar"
            aria-label="환경 진단 진행"
          >
            <motion.div
              className="h-full bg-primary"
              initial={{ width: "5%" }}
              animate={{ width: `${(stepIdx + 1) * 18}%` }}
              transition={{ ease: "easeOut", duration: 0.4 }}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={stepIdx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="text-ink text-sm font-medium"
            >
              <AutoTerm>{STEPS[stepIdx] ?? ""}</AutoTerm>
            </motion.p>
          </AnimatePresence>

          {/* 15초 이상 걸리면 안내 — 멈춘 게 아님을 알림. */}
          {stalled && isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-xl bg-warning/10 border border-warning/30 p-3 text-left"
            >
              <p className="text-xs text-ink mb-2 font-medium">
                ⏳ 오래 걸리네요...
              </p>
              <p className="text-[11px] text-subtle leading-relaxed mb-3">
                일부 도구 (Python, AI 도구 등) 가 깊이 있어서 시간이 더 걸릴 수 있어요.
                30초 더 기다리거나, 건너뛰고 진행해도 돼요.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-subtle/20 text-[11px] text-subtle hover:text-ink"
                >
                  🔄 다시 시도
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-medium"
                >
                  ⏭ 건너뛰고 진행
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}

      {isError && (
        <div className="mt-6 rounded-2xl bg-warning/10 border border-warning/30 p-5 text-left">
          <p className="text-sm text-ink mb-1 font-medium">
            😕 잠깐 멈췄어요
          </p>
          <p className="text-xs text-subtle mb-4">
            뭐가 막혔는지 정확히 모르겠지만, 두 가지로 계속할 수 있어요.
          </p>
          {error instanceof Error && (
            <p className="text-[10px] font-mono text-subtle/70 mb-4 truncate">
              {error.message}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90"
            >
              🔄 다시 살펴보기
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-2.5 rounded-xl bg-surface border border-subtle/20 text-sm text-subtle hover:text-ink"
            >
              ⏭ 건너뛰고 진행 (수동으로 알려드릴게요)
            </button>
          </div>
        </div>
      )}

      <TerminalCheatsheet
        open={cheatsheetOpen}
        onClose={() => {
          markCheatsheetSeen();
          setCheatsheetOpen(false);
        }}
        onNeverAgain={() => {
          dismissCheatsheetForever();
          setCheatsheetOpen(false);
        }}
      />
    </motion.section>
  );
}

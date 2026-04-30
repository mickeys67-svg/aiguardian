import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useEnvironment } from "@/lib/hooks";
import { useOnboarding } from "../state";

// v0.9 §2.2 Stage 1 — 진단 진행 중 30초 동안 단계마다 1줄 메시지.
const STEPS = [
  "터미널 환경 확인 중...",
  "Python · Node · Git 확인 중...",
  "패키지 매니저 확인 중...",
  "AI 도구 (Claude · Cursor) 확인 중...",
  "결과 정리 중...",
];

export function Diagnosis() {
  const { data, isLoading, isError, error } = useEnvironment();
  const next = useOnboarding((s) => s.next);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (!isLoading) return;
    const id = window.setInterval(() => {
      setStepIdx((i) => (i + 1 < STEPS.length ? i + 1 : i));
    }, 600);
    return () => window.clearInterval(id);
  }, [isLoading]);

  useEffect(() => {
    if (data && !isLoading) {
      const t = window.setTimeout(() => next(), 700);
      return () => window.clearTimeout(t);
    }
  }, [data, isLoading, next]);

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
          {STEPS[stepIdx]}
        </motion.p>
      </AnimatePresence>

      {isError && (
        <p className="mt-6 text-error text-sm">
          진단이 멈췄어요: {error instanceof Error ? error.message : "알 수 없는 오류"}
        </p>
      )}
    </motion.section>
  );
}

import { motion } from "framer-motion";
import { useState } from "react";
import { useOnboarding } from "../state";
import { isOptedIn, setOptedIn } from "@/lib/telemetry";
import { APP_VERSION, APP_TAGLINE } from "@/lib/version";
import { AutoTerm } from "../components/AutoTerm";

export function Welcome() {
  const next = useOnboarding((s) => s.next);
  const [telemetry, setTelemetry] = useState<boolean>(isOptedIn());

  const handleStart = () => {
    setOptedIn(telemetry);
    next();
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="max-w-xl text-center px-6"
    >
      <div className="text-6xl mb-6" aria-hidden>
        ✨
      </div>
      <h1 className="text-3xl font-bold text-ink mb-3">
        👋 안녕하세요
      </h1>
      <p className="text-ink mb-3">
        컴퓨터로 처음 뭔가를 만들어보려는 분이군요.
      </p>
      <p className="text-subtle mb-2 text-sm">
        제가 30분 동안 옆에서 같이 갈게요. 부족한 건 다 깔아드릴게요.
      </p>
      <p className="text-subtle mb-6 text-xs leading-relaxed max-w-md mx-auto">
        <span className="font-medium">바이브코딩</span> 이란 자연어로 AI 한테 부탁해서 코드를 받는 방식이에요.
        Vibemate 가 환경 진단 → 도구 자동 설치 → AI 연결 → 첫 결과물까지 안내해드려요.
      </p>

      <label className="flex items-center justify-center gap-2 mb-6 text-xs text-subtle cursor-pointer">
        <input
          type="checkbox"
          checked={telemetry}
          onChange={(e) => setTelemetry(e.target.checked)}
          className="rounded text-primary focus:ring-primary/40"
        />
        <span>
          익명 사용 통계 보내기 (가디언 개선용 · 명령어·파일 내용 절대 안 보내요)
        </span>
      </label>

      <button
        type="button"
        onClick={handleStart}
        className="px-6 py-3 rounded-xl bg-primary text-white font-medium shadow-sm hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        시작
      </button>
      <p className="mt-6 text-xs text-subtle">v{APP_VERSION} · {APP_TAGLINE}</p>
    </motion.section>
  );
}

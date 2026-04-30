import { motion } from "framer-motion";
import { useState } from "react";
import { useOnboarding } from "../state";
import { isOptedIn, setOptedIn } from "@/lib/telemetry";

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
        안녕하세요. 컴퓨터 상태부터 봐드릴게요.
      </h1>
      <p className="text-subtle mb-6">
        걱정 마세요. 부족한 건 제가 다 깔아드릴게요. 비밀번호는 한 번만 물어봐요.
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
        시작할게요
      </button>
      <p className="mt-6 text-xs text-subtle">v0.1 · TG (Terminal Guardian)</p>
    </motion.section>
  );
}

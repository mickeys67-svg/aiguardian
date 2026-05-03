import { motion } from "framer-motion";
import { useState } from "react";
import { useOnboarding } from "../state";
import { isOptedIn, setOptedIn } from "@/lib/telemetry";
import { legalUrl } from "@/lib/legal";

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

      <label className="flex items-start justify-center gap-2 mb-3 text-xs text-subtle cursor-pointer">
        <input
          type="checkbox"
          checked={telemetry}
          onChange={(e) => setTelemetry(e.target.checked)}
          className="mt-0.5 rounded text-primary focus:ring-primary/40"
        />
        <span className="text-left">
          <strong>(선택)</strong> 익명 사용 통계 보내기 — 가디언 개선용. 명령어·파일 내용은 절대 안 보내요.
          {" "}
          <a
            href={legalUrl("privacy")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            어떤 데이터인지 보기
          </a>
        </span>
      </label>

      <button
        type="button"
        onClick={handleStart}
        className="px-6 py-3 rounded-xl bg-primary text-white font-medium shadow-sm hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        시작할게요
      </button>

      <p className="mt-4 text-[11px] text-subtle">
        시작을 누르면{" "}
        <a
          href={legalUrl("terms")}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          이용약관
        </a>
        {" "}및{" "}
        <a
          href={legalUrl("privacy")}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          개인정보 처리방침
        </a>
        에 동의하는 것으로 간주됩니다. 만 14세 미만은 법정대리인의 동의가 필요해요.
      </p>
      <p className="mt-3 text-xs text-subtle">v0.1 · TG (Terminal Guardian)</p>
    </motion.section>
  );
}

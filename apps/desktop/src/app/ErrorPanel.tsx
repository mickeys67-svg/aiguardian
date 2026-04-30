// v0.9 §3.4 에러 화면. 빨간 X 절대 사용 금지.
// 부드러운 노란 배경 + "잠깐 멈췄어요" + 한국어 번역 + AI 자동 호출 버튼.

import { useState } from "react";
import { motion } from "framer-motion";

const FRIENDLY_TRANSLATIONS: Array<{ pattern: RegExp; ko: string }> = [
  { pattern: /command not found/i, ko: "그 명령어를 컴퓨터가 못 찾았어요. 도구가 안 깔렸을 수 있어요." },
  { pattern: /permission denied/i, ko: "권한이 부족해요. 비밀번호 한 번만 더 물어볼 수 있어요." },
  { pattern: /no such file or directory/i, ko: "그 폴더나 파일이 없어요. 위치를 다시 확인할게요." },
  { pattern: /address already in use/i, ko: "그 포트가 이미 다른 프로그램이 쓰고 있어요." },
  { pattern: /network is unreachable|getaddrinfo|enotfound/i, ko: "인터넷 연결이 잠깐 끊긴 것 같아요." },
];

function translate(message: string): string {
  for (const { pattern, ko } of FRIENDLY_TRANSLATIONS) {
    if (pattern.test(message)) return ko;
  }
  return "이 에러는 처음 보는 종류예요. 같이 풀어볼게요.";
}

interface Props {
  rawError: string;
  onAskAi: () => void;
  onDismiss?: () => void;
}

export function ErrorPanel({ rawError, onAskAi, onDismiss }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const friendly = translate(rawError);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl w-full mx-auto rounded-2xl bg-warning/10 border border-warning/40 p-6"
      role="alert"
    >
      <header className="flex items-center gap-3 mb-3">
        <span className="text-2xl" aria-hidden>
          ☕
        </span>
        <h2 className="text-lg font-semibold text-ink">잠깐 멈췄어요</h2>
      </header>

      <p className="text-sm text-ink mb-2">{friendly}</p>
      <p className="text-xs text-subtle mb-5">
        에러는 실패가 아니에요. 컴퓨터가 도움 요청하는 거예요.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAskAi}
          className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition"
        >
          AI한테 자동으로 물어볼게요
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2.5 rounded-xl bg-surface border border-subtle/20 text-sm text-subtle hover:text-ink transition"
          >
            나중에
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="mt-4 text-xs text-subtle hover:text-ink transition"
      >
        {showRaw ? "원본 메시지 숨기기" : "원본 메시지 보기"}
      </button>

      {showRaw && (
        <pre className="mt-2 text-[11px] font-mono bg-bg rounded-lg p-3 text-ink/70 whitespace-pre-wrap max-h-40 overflow-auto">
          {rawError}
        </pre>
      )}
    </motion.section>
  );
}

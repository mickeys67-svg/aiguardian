// 터미널 단축키 치트시트 — Ctrl+C 트랩 등 입문자 함정을 한 번에.
// TerminalPane 첫 펼침 시 자동 노출. 이후엔 ? 버튼으로 호출.

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  /** "이 안내 다시 안 보기" 옵션 — Diagnosis/Confirm/TerminalPane 전부 활용. */
  onNeverAgain?: () => void;
}

const ROWS: Array<{ keys: string[]; label: string; danger?: boolean }> = [
  {
    keys: ["Ctrl", "Shift", "C"],
    label: "복사 — 일반 Ctrl+C 는 멈춤이라 안 돼요",
    danger: true,
  },
  { keys: ["Ctrl", "Shift", "V"], label: "붙여넣기" },
  { keys: ["우클릭"], label: "Windows Terminal: 즉시 붙여넣기" },
  { keys: ["Ctrl", "C"], label: "⚠️ 명령 멈춤 / claude 세션 종료", danger: true },
  { keys: ["↑", "↓"], label: "이전·다음 명령 불러오기" },
  { keys: ["Tab"], label: "단어·파일 자동완성" },
  { keys: ["Ctrl", "L"], label: "화면 깨끗이 지우기 (기록은 살아있음)" },
  { keys: ["exit", "Enter"], label: "터미널에서 나가기" },
];

export function TerminalCheatsheet({ open, onClose, onNeverAgain }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-ink/50"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="relative w-full max-w-md rounded-2xl bg-surface border border-subtle/15 shadow-xl p-5"
            role="dialog"
          >
            <header className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-3xl mb-1" aria-hidden>
                  ⌨️
                </p>
                <h2 className="text-lg font-semibold text-ink">
                  터미널 단축키 — 함정 피하는 법
                </h2>
                <p className="text-xs text-subtle mt-1">
                  까만 창에서 입문자가 가장 많이 빠지는 함정 8개. 한 번 보면 충분.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-subtle hover:text-ink text-lg"
                aria-label="닫기"
              >
                ✕
              </button>
            </header>

            <ul className="space-y-2.5">
              {ROWS.map((r, i) => (
                <li
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                    r.danger
                      ? "bg-warning/5 border border-warning/30"
                      : "bg-bg border border-subtle/10"
                  }`}
                >
                  <div className="flex items-center gap-1 shrink-0">
                    {r.keys.map((k, j) => (
                      <span
                        key={j}
                        className="kbd"
                        style={{ fontSize: "11px", padding: "2px 6px" }}
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-ink flex-1">{r.label}</span>
                </li>
              ))}
            </ul>

            <p className="text-[10px] text-subtle mt-4">
              💡 우상단 ? 또는 터미널 패널의 ⌨️ 단축키 버튼으로 다시 볼 수 있어요.
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90"
              >
                알겠어요
              </button>
              {onNeverAgain && (
                <button
                  type="button"
                  onClick={onNeverAgain}
                  className="px-4 py-2 rounded-xl bg-surface border border-subtle/20 text-xs text-subtle hover:text-ink"
                  title="이 안내 다시 안 보기. Settings → 데이터 정리에서 리셋 가능."
                >
                  다시 안 보기
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

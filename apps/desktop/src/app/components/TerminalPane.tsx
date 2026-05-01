// 항상 떠있는 터미널 패널 — 사용자가 필요할 때 여는 게 아니라 작업 내내 흐름을 봄.
// AI 호출, 레시피 명령, 파일 저장, 에러 — 모두 여기에 라이브로 흘러옴.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useTerminalLines,
  clearTerminal,
  type TerminalLine,
} from "@/lib/terminalLog";
import { TerminalCheatsheet } from "./TerminalCheatsheet";
import { ConfirmModal } from "./ConfirmModal";
import {
  shouldShowCheatsheet,
  markCheatsheetSeen,
  dismissCheatsheetForever,
} from "@/lib/cheatsheet";

const KIND_ICON: Record<TerminalLine["kind"], string> = {
  info: "•",
  command: "❯",
  stdout: " ",
  stderr: "!",
  error: "✕",
  success: "✓",
  ai: "🤖",
};

const KIND_COLOR: Record<TerminalLine["kind"], string> = {
  info: "text-white/60",
  command: "text-emerald-300",
  stdout: "text-white/80",
  stderr: "text-amber-300",
  error: "text-red-400",
  success: "text-emerald-400",
  ai: "text-sky-300",
};

interface Props {
  /** 시작 시 펼친 상태로 둘지 */
  defaultOpen?: boolean;
  /** 컨테이너 변형 — Shell 하단 vs IterateScreen 측면 */
  variant?: "bottom" | "inline";
}

export function TerminalPane({ defaultOpen = true, variant = "bottom" }: Props) {
  const lines = useTerminalLines();
  const [open, setOpen] = useState(defaultOpen);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 새 라인 도착 시 자동 스크롤.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, open]);

  // 첫 펼침 시 치트시트 자동 노출 — 단, 3회 dismiss 후엔 OFF.
  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && shouldShowCheatsheet()) {
      setCheatsheetOpen(true);
    }
  };

  const containerCls =
    variant === "bottom"
      ? "fixed bottom-0 left-56 right-0 z-20"
      : "relative w-full";

  return (
    <div className={containerCls}>
      <div className="bg-ink/95 border-t border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        {/* 헤더 — 항상 보임. 클릭으로 토글. */}
        <button
          type="button"
          onClick={handleToggle}
          className="w-full flex items-center gap-2 px-4 py-1.5 text-white/90 hover:bg-white/5"
        >
          <span aria-hidden>💻</span>
          <span className="text-xs font-medium">터미널</span>
          <span className="text-[10px] text-white/50">
            ({lines.length}개 기록)
          </span>
          <span className="ml-auto flex items-center gap-2">
            {open && (
              <>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setCheatsheetOpen(true);
                  }}
                  role="button"
                  tabIndex={0}
                  className="text-[10px] text-white/50 hover:text-white px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer"
                  title="단축키 도움말"
                >
                  ⌨️ 단축키
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmClearOpen(true);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setConfirmClearOpen(true);
                    }
                  }}
                  className="text-[10px] text-white/50 hover:text-white px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer"
                >
                  지우기
                </span>
              </>
            )}
            <span className="text-[10px] text-white/50">
              {open ? "▼ 접기" : "▲ 펼치기"}
            </span>
          </span>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div
                ref={scrollRef}
                className="px-4 py-2 max-h-[200px] overflow-y-auto font-mono text-[11px] leading-relaxed"
              >
                {lines.length === 0 ? (
                  <p className="text-white/40 italic">
                    아직 기록이 없어요. 작업을 시작하면 여기에 흐릅니다.
                  </p>
                ) : (
                  lines.map((line) => (
                    <div
                      key={line.id}
                      className={`flex items-start gap-2 ${KIND_COLOR[line.kind]}`}
                    >
                      <span className="shrink-0 w-4 text-center select-none">
                        {KIND_ICON[line.kind]}
                      </span>
                      <span className="text-white/30 shrink-0 select-none">
                        {new Date(line.at).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                      <span className="flex-1 whitespace-pre-wrap break-all">
                        {line.text}
                        {line.detail && (
                          <span className="block text-white/40 text-[10px] mt-0.5">
                            {line.detail}
                          </span>
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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

      <ConfirmModal
        open={confirmClearOpen}
        title="터미널 기록을 모두 지울까요?"
        message="화면의 로그만 지웁니다. 실제 파일·작업은 그대로예요."
        danger
        confirmLabel="지우기"
        onConfirm={() => {
          clearTerminal();
          setConfirmClearOpen(false);
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
}

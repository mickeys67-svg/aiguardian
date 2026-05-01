// 우하단 떠다니는 📸·🤖 버튼.
// 1클릭 = 캡처 + AI 챗 자동 열림.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { captureOnce, type CaptureMode, approxSizeKb } from "@/lib/capture";
import { ConfirmModal } from "./components/ConfirmModal";
import type { ChatContext } from "@/lib/aiChat";

interface Props {
  context: ChatContext;
  onCapture: (dataUrl: string) => void;
  onOpenChat: () => void;
}

const CAPTURE_FIRST_USE_KEY = "tg.capture.firstUseDismissed";

export function CaptureFloater({ context, onCapture, onOpenChat }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstUse, setFirstUse] = useState(
    () => !localStorage.getItem(CAPTURE_FIRST_USE_KEY),
  );

  // 글로벌 단축키.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        void doCapture("screen");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doCapture = async (mode: CaptureMode) => {
    if (busy) return;
    if (firstUse) {
      // 첫 사용 안내 모달이 떠있는 동안엔 캡처 미실행.
      return;
    }
    setMenuOpen(false);
    setBusy(true);
    setError(null);
    try {
      const r = await captureOnce(mode);
      onCapture(r.dataUrl);
      onOpenChat();
      void context;
      void approxSizeKb;
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      // 친화적 카피로 변환.
      let friendly = "캡처가 실패했어요.";
      if (/permission|denied|notallowed/i.test(raw)) {
        friendly = "공유를 취소하셨어요. 📸 버튼 다시 눌러주세요.";
      } else if (/not.{0,5}support/i.test(raw)) {
        friendly = "이 환경에서는 캡처가 지원되지 않아요. Ctrl+Shift+A 도 시도해보세요.";
      } else if (/no .{0,8}track/i.test(raw)) {
        friendly = "화면을 못 받아왔어요. 다시 시도해주세요.";
      }
      setError(friendly);
      window.setTimeout(() => setError(null), 6000);
    } finally {
      setBusy(false);
    }
  };

  const dismissFirstUse = (proceed: boolean) => {
    localStorage.setItem(CAPTURE_FIRST_USE_KEY, "1");
    setFirstUse(false);
    if (proceed) {
      void doCapture("screen");
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3">
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="rounded-2xl bg-surface border border-subtle/15 shadow-xl py-1.5 w-56"
            >
              <MenuItem
                icon="📷"
                label="전체 화면"
                hint="기본 — Ctrl+Shift+A"
                onClick={() => void doCapture("screen")}
              />
              <MenuItem
                icon="🪟"
                label="이 창만"
                onClick={() => void doCapture("window")}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="text-[11px] text-error bg-error/10 border border-error/20 rounded-xl px-3 py-1.5 max-w-[260px]">
            {error}
          </div>
        )}

        <button
          type="button"
          aria-label="화면을 AI에게 보여주기"
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpen((v) => !v);
          }}
          onClick={() => void doCapture("screen")}
          disabled={busy}
          className="group w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:scale-105 transition-transform flex items-center justify-center disabled:opacity-60"
        >
          <span className="text-xl">{busy ? "⏳" : "📸"}</span>
        </button>

        <button
          type="button"
          aria-label="AI에게 물어보기"
          onClick={onOpenChat}
          className="w-12 h-12 rounded-full bg-surface border border-subtle/20 text-ink shadow hover:border-primary/40 hover:text-primary flex items-center justify-center"
        >
          <span className="text-lg">🤖</span>
        </button>
      </div>

      <ConfirmModal
        open={firstUse}
        title="📸 화면 캡처 처음이시죠?"
        message="AI에게 화면을 보낼 때 어떻게 동작하는지 알려드릴게요."
        safeNote="비밀번호·이메일 같은 건 자동으로 가려요"
        warnNote="다른 앱이 켜져있으면 그 화면도 보낼 수 있어요. 한 번 더 확인하세요."
        confirmLabel="알겠어요, 캡처할게요"
        cancelLabel="나중에"
        onConfirm={() => dismissFirstUse(true)}
        onCancel={() => dismissFirstUse(false)}
      />
    </>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: string;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-ink hover:bg-bg"
    >
      <span aria-hidden className="text-base">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block">{label}</span>
        {hint && <span className="block text-[10px] text-subtle">{hint}</span>}
      </span>
    </button>
  );
}

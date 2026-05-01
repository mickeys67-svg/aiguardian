// 확인 모달 — 되돌리기 어려운 동작 직전. 안내 모드와 무관하게 항상 작동.

import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  title: string;
  /** 동작 한 줄 설명 */
  message: string;
  /** 안전 메모 — "이건 되돌릴 수 있어요" 같은 안심 한 줄 */
  safeNote?: string;
  /** 주의 메모 — "이건 되돌리기 어려워요" 같은 경고 한 줄 */
  warnNote?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 위험도 — 상위면 빨간색, 일반은 파란색 */
  danger?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  safeNote,
  warnNote,
  confirmLabel = "계속할게요",
  cancelLabel = "취소",
  danger,
  children,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink/40" onClick={onCancel} aria-hidden />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-md rounded-2xl bg-surface border border-subtle/15 shadow-xl p-6"
            role="dialog"
            aria-modal="true"
          >
            <header className="flex items-start gap-3 mb-3">
              <span aria-hidden className="text-2xl">
                ⚠️
              </span>
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
            </header>
            <p className="text-sm text-ink mb-3">{message}</p>
            {safeNote && (
              <p className="text-xs text-success mb-1">✓ {safeNote}</p>
            )}
            {warnNote && (
              <p className="text-xs text-warning mb-1">⚠ {warnNote}</p>
            )}
            {children && <div className="mt-3">{children}</div>}
            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl bg-surface border border-subtle/20 text-sm text-subtle hover:text-ink"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 ${
                  danger ? "bg-error" : "bg-primary"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

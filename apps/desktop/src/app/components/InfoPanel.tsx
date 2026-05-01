// ⓘ 슬라이드 패널 — 우측에서 슬라이드 인. 무엇 / 왜 / 안전한가 3문단.

import { motion, AnimatePresence } from "framer-motion";
import { GLOSSARY } from "@/lib/glossary";

interface Props {
  /** 글로서리 키 */
  term: string | null;
  onClose: () => void;
}

export function InfoPanel({ term, onClose }: Props) {
  const entry = term ? GLOSSARY[term] : undefined;

  return (
    <AnimatePresence>
      {entry && term && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="flex-1 bg-ink/30"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            initial={{ x: 360 }}
            animate={{ x: 0 }}
            exit={{ x: 360 }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="w-[360px] bg-surface border-l border-subtle/15 shadow-xl flex flex-col"
            role="dialog"
            aria-label={`${term} 용어 설명`}
          >
            <header className="px-5 py-4 border-b border-subtle/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-subtle">용어</p>
                <h3 className="text-lg font-bold text-ink">{term}</h3>
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
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 text-sm text-ink">
              <Block title="무엇인가요?" body={entry.what} />
              <Block title="왜 필요해요?" body={entry.why} />
              <Block title="안전해요?" body={entry.safe} />
            </div>
            <footer className="px-5 py-3 border-t border-subtle/10 text-[11px] text-subtle">
              어렵게 느껴지면 우하단 🤖 버튼으로 더 물어볼 수 있어요.
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h4 className="text-xs font-semibold text-primary mb-1.5">{title}</h4>
      <p className="text-sm leading-relaxed text-ink/90">{body}</p>
    </section>
  );
}

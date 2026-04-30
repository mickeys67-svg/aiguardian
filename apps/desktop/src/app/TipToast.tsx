import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { globalTipQueue, type Tip } from "@tg/tip-engine";

const PATTERN_STYLES: Record<Tip["pattern"], string> = {
  예고형: "border-primary/30 bg-primary/5",
  교육형: "border-subtle/20 bg-surface",
  검증형: "border-warning/40 bg-warning/5",
  해석형: "border-subtle/20 bg-surface",
  축하형: "border-success/30 bg-success/5",
  위로형: "border-error/20 bg-error/5",
};

export function TipToast() {
  const [current, setCurrent] = useState<Tip | undefined>(undefined);

  useEffect(() => {
    const pump = () => {
      if (!current) {
        const next = globalTipQueue.next();
        if (next) setCurrent(next);
      }
    };
    const unsub = globalTipQueue.subscribe(pump);
    pump();
    return unsub;
  }, [current]);

  useEffect(() => {
    if (!current?.ttlMs) return;
    const t = window.setTimeout(() => setCurrent(undefined), current.ttlMs);
    return () => window.clearTimeout(t);
  }, [current]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="fixed bottom-6 right-6 max-w-sm z-50"
        >
          <div
            role="status"
            className={`rounded-2xl border ${PATTERN_STYLES[current.pattern]} shadow-sm p-4`}
          >
            <p className="text-[11px] uppercase tracking-wide text-subtle mb-1">
              {current.pattern}
            </p>
            <p className="text-sm text-ink leading-relaxed">{current.message}</p>
            <button
              type="button"
              onClick={() => setCurrent(undefined)}
              className="mt-3 text-xs text-subtle hover:text-ink transition"
            >
              닫기
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

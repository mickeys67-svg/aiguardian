// 코치마크 — 화면 진입 시 핵심 요소 가리키며 한 번 안내.
// 영구 dismiss 가능. 안내 모드 OFF/Minimal 이거나 dismiss 했으면 표시 안 함.

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useGuidance } from "@/lib/guidance";

interface Props {
  /** 영구 dismiss 추적용 ID */
  id: string;
  /** 풍선이 가리킬 요소의 selector — null 이면 가운데 노출 (화살표 없음) */
  anchor?: string;
  title: string;
  body: string;
  /** "다음" 대신 다른 라벨로 바꾸고 싶을 때 */
  ctaLabel?: string;
  /** 이 화면 ID — silencedScreens 와 연동 */
  screenId?: string;
}

export function Coachmark({
  id,
  anchor,
  title,
  body,
  ctaLabel = "알겠어요",
  screenId,
}: Props) {
  const shouldShow = useGuidance((s) => s.shouldShow);
  const dismissCoachmark = useGuidance((s) => s.dismissCoachmark);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!shouldShow("coachmark", screenId, id)) return;
    // 살짝 지연 — 화면 마운트 직후엔 피로하니 200ms.
    const t = window.setTimeout(() => setVisible(true), 200);
    return () => window.clearTimeout(t);
  }, [id, screenId, shouldShow]);

  useEffect(() => {
    if (!visible || !anchor) return;
    const update = () => {
      const el = document.querySelector(anchor);
      if (!el) return setPos(null);
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top + r.height });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [visible, anchor]);

  const handleDismiss = () => {
    setVisible(false);
    dismissCoachmark(id);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-40 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* 반투명 오버레이 — 풍선 외 영역 살짝 어둡게 */}
          <div className="absolute inset-0 bg-ink/10" />

          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            className="absolute pointer-events-auto"
            style={
              pos
                ? {
                    left: Math.max(20, Math.min(window.innerWidth - 320, pos.x - 160)),
                    top: pos.y + 12,
                  }
                : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
            }
          >
            {pos && (
              <div
                className="w-3 h-3 bg-primary mx-auto -mb-1.5 rotate-45"
                style={{ marginLeft: 144 }}
                aria-hidden
              />
            )}
            <div className="w-80 rounded-2xl bg-primary text-white p-4 shadow-xl">
              <h4 className="font-semibold text-sm mb-1">💡 {title}</h4>
              <p className="text-xs text-white/90 mb-3 leading-relaxed">{body}</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-[11px] text-white/70 hover:text-white"
                >
                  다시 보지 않기
                </button>
                <button
                  type="button"
                  onClick={() => setVisible(false)}
                  className="px-3 py-1 rounded-lg bg-white text-primary text-xs font-medium hover:bg-white/90"
                >
                  {ctaLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

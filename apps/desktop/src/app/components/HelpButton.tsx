// 우상단 ? 버튼 — 안내 빠른 토글 + 도움 메뉴.
// 어떤 화면에서도 떠있는 안전망.

import { useState } from "react";
import { useGuidance } from "@/lib/guidance";

interface Props {
  /** 현재 화면 ID — "지금 이 화면만 조용히" 가 동작할 대상 */
  screenId?: string;
  /** "이 화면 다시 안내받기" 클릭 시 호출 — 화면이 이 콜백으로 코치마크 재실행 */
  onReplayCoachmarks?: () => void;
  /** AI 챗 열기 콜백 */
  onOpenChat?: () => void;
}

export function HelpButton({ screenId, onReplayCoachmarks, onOpenChat }: Props) {
  const [open, setOpen] = useState(false);
  const setMode = useGuidance((s) => s.setMode);
  const silenceScreen = useGuidance((s) => s.silenceScreen);
  const resetCoachmarks = useGuidance((s) => s.resetCoachmarks);

  return (
    <div className="fixed top-4 right-4 z-30">
      <button
        type="button"
        aria-label="도움말"
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-surface border border-subtle/20 text-ink hover:border-primary/40 hover:text-primary shadow-sm flex items-center justify-center text-base font-bold"
      >
        ?
      </button>

      {open && (
        <div
          className="absolute right-0 top-11 w-64 rounded-2xl bg-surface border border-subtle/15 shadow-xl py-1.5"
          onMouseLeave={() => setOpen(false)}
        >
          <Item
            icon="🎯"
            label="이 화면 다시 안내"
            onClick={() => {
              resetCoachmarks();
              onReplayCoachmarks?.();
              setOpen(false);
            }}
          />
          <Item
            icon="🤫"
            label="지금 이 화면만 조용히"
            disabled={!screenId}
            onClick={() => {
              if (screenId) silenceScreen(screenId);
              setOpen(false);
            }}
          />
          <Item
            icon="📴"
            label="안내 모두 끄기"
            onClick={() => {
              setMode("off");
              setOpen(false);
            }}
          />
          <div className="my-1 border-t border-subtle/10" />
          <Item
            icon="🤖"
            label="AI한테 물어보기"
            onClick={() => {
              onOpenChat?.();
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function Item({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-ink hover:bg-bg disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span aria-hidden className="text-base">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

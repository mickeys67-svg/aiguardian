// 툴팁 — 단어 호버 시 한 줄 설명. 안내 모드 OFF 면 아무것도 안 보임.

import { type ReactNode, useState } from "react";
import { useGuidance } from "@/lib/guidance";
import { glossaryShort } from "@/lib/glossary";

interface Props {
  /** 글로서리에 등록된 용어. 등록되어 있으면 자동으로 풀이를 가져옴. */
  term?: string;
  /** 직접 풀이 — term 보다 우선. */
  text?: string;
  children: ReactNode;
}

export function Tooltip({ term, text, children }: Props) {
  const shouldShow = useGuidance((s) => s.shouldShow);
  const [open, setOpen] = useState(false);
  const enabled = shouldShow("tooltip");

  const message = text ?? (term ? glossaryShort(term) : undefined);
  if (!enabled || !message) {
    return <span>{children}</span>;
  }

  return (
    <span
      className="relative inline-block underline decoration-dotted decoration-subtle/50 underline-offset-2 cursor-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 whitespace-nowrap text-[11px] text-white bg-ink/90 rounded-md px-2 py-1 shadow-md pointer-events-none"
        >
          {message}
        </span>
      )}
    </span>
  );
}

// 브라우저 dev 모드에서만 표시되는 배너.
// Tauri 데스크톱 앱 안에서는 안 보임.

import { useState } from "react";

function isTauri(): boolean {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  );
}

const DISMISS_KEY = "tg.demo.bannerDismissed";

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(
    () => !!sessionStorage.getItem(DISMISS_KEY),
  );
  if (isTauri() || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning/90 text-ink text-xs px-4 py-1.5 flex items-center justify-center gap-3 shadow">
      <span aria-hidden>🧪</span>
      <span>
        <strong>데모 모드</strong> — 브라우저에서는 실제 컴퓨터 상태·파일 작업을 볼 수
        없어요. 도구 상태는 가짜예요. 실제 동작은 데스크톱 앱
        (<code className="font-mono bg-ink/10 px-1 rounded">tauri dev</code>) 에서만
        보입니다.
      </span>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        className="text-ink/70 hover:text-ink ml-2"
        aria-label="배너 닫기"
      >
        ✕
      </button>
    </div>
  );
}

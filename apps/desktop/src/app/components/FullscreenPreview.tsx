// 결과물 풀스크린 미리보기 — 새 탭/팝업 없이 앱 안에서 큰 화면.
// window.open 차단·localStorage 미스매치·HMR 캐시 — 모든 문제 우회.

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { readFile, isTauri, openArtifactInTauri } from "@/lib/tauri";

interface Props {
  path: string | null;
  open: boolean;
  onClose: () => void;
}

export function FullscreenPreview({ path, open, onClose }: Props) {
  const [contents, setContents] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !path) return;
    setLoading(true);
    setError(null);
    void readFile(path)
      .then((c) => {
        if (!c) {
          setError(
            "파일 본문을 못 찾았어요. 자동 모드로 다시 만들어주시면 보입니다.",
          );
          setContents("");
        } else {
          setContents(c);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "로드 실패"))
      .finally(() => setLoading(false));
  }, [open, path]);

  // ESC 로 닫기.
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const isHtml =
    path?.endsWith(".html") || /^\s*<!doctype html|<html/i.test(contents);

  const tryNewTab = async () => {
    if (!path) return;
    if (isTauri()) {
      await openArtifactInTauri(path);
      return;
    }
    // 브라우저: blob 새 탭 시도 — 팝업 차단되면 그냥 안 됨.
    try {
      const blob = new Blob([contents], {
        type: isHtml ? "text/html" : "text/plain",
      });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] bg-ink/95 flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <header className="flex items-center justify-between px-5 py-3 border-b border-white/10 text-white">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wide text-white/60">
                미리보기
              </p>
              <p className="text-xs font-mono text-white/90 truncate">
                {path ?? ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void tryNewTab()}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs"
                title="새 탭으로 열기 (팝업 허용 필요)"
              >
                ↗ 새 탭
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-white text-ink text-xs font-medium hover:bg-white/90"
              >
                ✕ 닫기 (ESC)
              </button>
            </div>
          </header>

          <div className="flex-1 bg-white relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center text-subtle">
                불러오는 중...
              </div>
            )}
            {error && !loading && (
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="max-w-md text-center">
                  <p className="text-4xl mb-3" aria-hidden>
                    😕
                  </p>
                  <p className="text-sm text-ink mb-2">{error}</p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 px-4 py-2 rounded-xl bg-primary text-white text-xs font-medium"
                  >
                    돌아가기
                  </button>
                </div>
              </div>
            )}
            {!loading && !error && contents && isHtml && (
              <iframe
                title="결과물 풀스크린 미리보기"
                srcDoc={contents}
                sandbox="allow-scripts"
                className="w-full h-full border-0"
              />
            )}
            {!loading && !error && contents && !isHtml && (
              <pre className="w-full h-full overflow-auto p-6 font-mono text-sm bg-bg text-ink whitespace-pre-wrap">
                {contents}
              </pre>
            )}
          </div>

          <footer className="px-5 py-2 border-t border-white/10 bg-ink text-white/60 text-[11px] text-center">
            ESC 또는 ✕ 닫기로 돌아갈 수 있어요.
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

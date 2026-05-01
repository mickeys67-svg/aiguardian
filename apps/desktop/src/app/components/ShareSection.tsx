// 친구한테 보여주기 — 임시 정적 서버 + QR. v0.9 Stage 8 의 최소 구현.
// 사용자가 같은 Wi-Fi 의 폰으로 QR 스캔 → 즉시 페이지 보임.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  serveArtifact,
  stopServeArtifact,
  isTauri,
  type ServeArtifactResult,
} from "@/lib/tauri";
import { logTerminal } from "@/lib/terminalLog";

interface Props {
  path: string;
  /** verifyKind 가 web 이면 dev server 안내로 분기. 미지정/html 이면 정적 공유. */
  verifyKind?: string;
  /** 레시피의 localUrl — web 분기에서 사용. */
  localUrl?: string;
}

export function ShareSection({ path, verifyKind, localUrl }: Props) {
  // web verifyKind 는 dist/ 폴더에 build 결과가 있어야 정적 공유 가능.
  // 사용자가 build 안 했을 가능성 — 명시 안내.
  const isWebDevServer = verifyKind === "web";
  const [serving, setServing] = useState<ServeArtifactResult | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 컴포넌트 unmount 시 서버 자동 종료.
  useEffect(() => {
    return () => {
      if (serving) void stopServeArtifact();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setStarting(true);
    setError(null);

    // 데모 모드: Rust 호출 안 하고 바로 가짜 URL 으로 흐름만 보여줌.
    if (!isTauri()) {
      await new Promise((r) => setTimeout(r, 600));
      setServing({
        url: "http://192.168.0.42:8080/",
        port: 8080,
        localIp: "192.168.0.42",
      });
      logTerminal({
        kind: "info",
        text: "🧪 (데모) 친구한테 보여주기 — 가짜 URL/QR. 실제 동작은 데스크톱 앱.",
      });
      setStarting(false);
      return;
    }

    try {
      const r = await serveArtifact(path);
      setServing(r);
      logTerminal({
        kind: "success",
        text: `🌐 친구한테 보여주기 시작 — ${r.url}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "공유 시작 실패";
      setError(msg);
      logTerminal({ kind: "stderr", text: `공유 실패: ${msg}` });
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    if (isTauri()) {
      await stopServeArtifact();
    }
    setServing(null);
    logTerminal({ kind: "info", text: "공유 중지됨" });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const qrUrl = serving
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(serving.url)}`
    : null;

  return (
    <section className="rounded-2xl bg-surface border border-subtle/15 p-5">
      <h3 className="font-semibold text-ink text-sm mb-2 flex items-center gap-2">
        <span aria-hidden>👥</span>
        친구한테 보여주기
      </h3>
      <p className="text-xs text-subtle mb-4">
        같은 Wi-Fi 의 폰에서 QR 만 스캔하면 친구가 바로 볼 수 있어요. 인터넷 배포 X
        — 가까운 사람한테만.
      </p>

      {isWebDevServer && (
        <div className="rounded-lg bg-warning/5 border border-warning/30 p-3 mb-3 text-[11px] text-ink">
          <p className="font-medium mb-1">
            ⚠️ 이 작품은 빌드(build) 후에만 공유 가능
          </p>
          <p className="text-subtle">
            먼저 터미널에서 <code className="font-mono bg-bg px-1 rounded">npm run build</code> 실행 →
            dist/ 폴더 생긴 뒤 아래 버튼으로 공유. 그렇지 않으면 빈 페이지가 떠요.
            {localUrl && (
              <>
                <br />
                개발 중엔 그냥 본인 폰에서 같은 Wi-Fi 로{" "}
                <code className="font-mono bg-bg px-1 rounded">{localUrl}</code> 입력해서 봐도 OK.
              </>
            )}
          </p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!serving ? (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button
              type="button"
              onClick={start}
              disabled={starting}
              className="w-full px-4 py-3 rounded-xl bg-primary text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              {starting ? "시작하는 중..." : "📡 친구한테 보여주기 시작"}
            </button>
            {error && (
              <p className="text-[11px] text-warning mt-2">{error}</p>
            )}
            <p className="text-[10px] text-subtle mt-2">
              💡 시작하면 임시 주소가 생기고 QR 코드가 뜹니다. 끝나면 "중지" 로
              주소를 닫아요.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {!isTauri() && (
              <div className="rounded-lg bg-warning/10 border border-warning/30 p-2 text-[11px] text-ink">
                🧪 <strong>데모 모드</strong> — 진짜 서버는 안 떴어요. 흐름만
                보여드립니다. 실제 동작은 데스크톱 앱에서.
              </div>
            )}
            <div className="flex items-start gap-4">
              {qrUrl && (
                <div className="rounded-xl bg-white p-3 border border-subtle/15 shrink-0">
                  <img
                    src={qrUrl}
                    alt="QR 코드 — 폰으로 스캔"
                    className="w-32 h-32 block"
                  />
                  <p className="text-[10px] text-subtle text-center mt-1">
                    폰 카메라로 스캔
                  </p>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-subtle">
                  주소
                </p>
                <code className="block text-xs font-mono text-ink truncate bg-bg rounded px-2 py-1.5 mb-2">
                  {serving.url}
                </code>
                <button
                  type="button"
                  onClick={() => void copy(serving.url)}
                  className={`w-full text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                    copied
                      ? "bg-success text-white"
                      : "bg-primary text-white hover:opacity-90"
                  }`}
                >
                  {copied ? "✓ 복사됨" : "📋 주소 복사"}
                </button>
                <p className="text-[10px] text-subtle mt-2">
                  💡 같은 Wi-Fi 에 연결된 기기만 접속 가능. 인터넷 배포 X.
                </p>
              </div>
            </div>

            <div className="border-t border-subtle/10 pt-3">
              <p className="text-xs font-medium text-ink mb-1.5">
                📱 폰에서 보는 방법
              </p>
              <ol className="text-[11px] text-subtle space-y-0.5 list-decimal list-inside">
                <li>폰이 같은 Wi-Fi 에 연결돼있는지 확인</li>
                <li>폰 카메라 앱으로 위 QR 스캔 → 알림 탭</li>
                <li>또는 위 주소를 카톡으로 보내고 폰에서 누르기</li>
              </ol>
            </div>

            <button
              type="button"
              onClick={() => void stop()}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-subtle/20 text-xs hover:border-error/40"
            >
              ⏹ 공유 중지
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

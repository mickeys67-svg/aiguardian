// AI 챗 패널 — 우측에서 슬라이드 인. 이미지 첨부 + 명령어 추천 카드.
// 글로벌 단일 인스턴스 (Shell 또는 App 레벨에서 mount).

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  makeUserMessage,
  sendChat,
  type ChatContext,
  type ChatMessage,
} from "@/lib/aiChat";
import { detectSensitive } from "@/lib/redact";
import { AutoTerm } from "./components/AutoTerm";
import { ConfirmModal } from "./components/ConfirmModal";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 외부에서 미리 넣은 캡처 이미지 — 열림과 동시에 첨부됨 */
  pendingImage?: string;
  context: ChatContext;
}

export function AiChat({ open, onClose, pendingImage, context }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attached, setAttached] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [warned, setWarned] = useState<string[]>([]);
  const [sensitiveConfirm, setSensitiveConfirm] = useState<{
    text: string;
    labels: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 외부에서 새 이미지가 들어오면 첨부.
  useEffect(() => {
    if (pendingImage) setAttached(pendingImage);
  }, [pendingImage]);

  // 새 메시지 도착 시 하단 스크롤.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const send = () => {
    if (sending) return;
    const text =
      draft.trim() || (attached ? "이 화면을 봐주세요. 뭐가 문제일까요?" : "");
    if (!text && !attached) return;
    // 민감 정보 사전 경고 — ConfirmModal 사용 (비동기).
    const hits = detectSensitive(text);
    if (hits.length > 0 && !warned.includes(text)) {
      const labels = [...new Set(hits.map((h) => h.label))].join(", ");
      setSensitiveConfirm({ text, labels });
      return;
    }
    void performSend(text);
  };

  const performSend = async (text: string) => {
    const userMsg = makeUserMessage(text, attached);
    setMessages((m) => [...m, userMsg]);
    setDraft("");
    setAttached(undefined);
    setSending(true);
    try {
      const r = await sendChat({
        text,
        imageDataUrl: userMsg.imageDataUrl,
        context,
      });
      setMessages((m) => [...m, r.reply]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: `잠깐 멈췄어요: ${
            e instanceof Error ? e.message : "알 수 없는 오류"
          }. 다시 시도하거나 우상단 ? 버튼으로 도움받으세요.`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const copy = (txt: string) => {
    void navigator.clipboard.writeText(txt);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex justify-end pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="flex-1 pointer-events-auto"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="w-[400px] bg-surface border-l border-subtle/15 shadow-xl flex flex-col pointer-events-auto"
            role="dialog"
            aria-label="AI 챗"
          >
            <header className="px-5 py-3 border-b border-subtle/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-subtle flex items-center gap-1.5">
                  AI 가디언
                  <span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning text-[9px] tracking-normal">
                    데모 모드
                  </span>
                </p>
                <h3 className="text-sm font-semibold text-ink">
                  여기서 막히셨어요? 뭐든 물어보세요
                </h3>
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

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2" aria-hidden>
                    🤖
                  </p>
                  <p className="text-xs text-subtle">
                    화면 캡처를 보내거나 글로 물어보세요.
                  </p>
                </div>
              )}
              {messages.map((m) => (
                <Bubble key={m.id} m={m} onCopy={copy} />
              ))}
              {sending && (
                <p className="text-xs text-subtle text-center py-2">
                  AI가 보고 있어요...
                </p>
              )}
            </div>

            {attached && (
              <div className="px-4 py-2 border-t border-subtle/10 flex items-center gap-2">
                <img
                  src={attached}
                  alt="첨부"
                  className="w-12 h-12 object-cover rounded border border-subtle/15"
                />
                <p className="text-xs text-subtle flex-1">화면이 첨부됐어요</p>
                <button
                  type="button"
                  onClick={() => setAttached(undefined)}
                  className="text-xs text-subtle hover:text-error"
                >
                  떼기
                </button>
              </div>
            )}

            <div className="px-3 py-3 border-t border-subtle/10">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  attached ? "그냥 보내도 돼요 (Enter)" : "어디가 막혔어요?"
                }
                className="w-full min-h-[60px] resize-none rounded-xl border border-subtle/20 px-3 py-2 text-sm bg-bg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[10px] text-subtle">
                  Enter 로 보내기 · Shift+Enter 줄바꿈
                </p>
                <button
                  type="button"
                  onClick={send}
                  disabled={sending}
                  className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50"
                >
                  ⚡ 보내기
                </button>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
      <ConfirmModal
        open={!!sensitiveConfirm}
        title="민감 정보가 포함되어 있어요"
        message={
          sensitiveConfirm
            ? `메시지에 ${sensitiveConfirm.labels} 이(가) 보여요. 그대로 보낼까요?`
            : ""
        }
        warnNote="AI 한테 보내면 외부 서비스로 전송돼요."
        confirmLabel="그대로 보내기"
        cancelLabel="다시 다듬기"
        danger
        onConfirm={() => {
          if (sensitiveConfirm) {
            const t = sensitiveConfirm.text;
            setWarned((w) => [...w, t]);
            setSensitiveConfirm(null);
            void performSend(t);
          }
        }}
        onCancel={() => setSensitiveConfirm(null)}
      />
    </AnimatePresence>
  );
}

function Bubble({
  m,
  onCopy,
}: {
  m: ChatMessage;
  onCopy: (txt: string) => void;
}) {
  const mine = m.role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
          mine
            ? "bg-primary text-white rounded-tr-sm"
            : "bg-bg border border-subtle/15 text-ink rounded-tl-sm"
        }`}
      >
        {m.imageDataUrl && (
          <img
            src={m.imageDataUrl}
            alt="첨부"
            className="rounded-lg mb-2 max-w-full border border-white/20"
          />
        )}
        <p className="whitespace-pre-wrap leading-relaxed">
          {mine ? m.text : <AutoTerm>{m.text}</AutoTerm>}
        </p>
        {m.suggestedCommands && m.suggestedCommands.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {m.suggestedCommands.map((c) => (
              <div
                key={c}
                className="rounded-lg bg-surface text-ink px-2 py-1.5 text-[11px] font-mono flex items-center justify-between gap-2"
              >
                <code className="truncate">{c}</code>
                <button
                  type="button"
                  onClick={() => onCopy(c)}
                  className="text-[10px] text-primary hover:underline shrink-0"
                >
                  📋 복사
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

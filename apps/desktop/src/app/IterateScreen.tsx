// 이터레이션 화면 — "수정하기" 진입점.
// 좌: 현재 결과 미리보기 (iframe)
// 우: AI 챗 (현재 코드 자동 첨부) + 타임라인
// 입문자가 1샷 이후 5~50번 반복하는 핵심 화면.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  readFile,
  writeFile,
  runClaudePrint,
  extractCodeBlock,
  parentFolder,
} from "@/lib/tauri";
import { logTerminal } from "@/lib/terminalLog";
import {
  addSnapshot,
  listSnapshots,
  toggleStar,
  deleteSnapshot,
  relativeTime,
  recordIteration,
  markMdSaved,
  generateSessionMd,
  readMeta,
  SESSION_SWITCH_THRESHOLD,
  type Snapshot,
} from "@/lib/iteration";
import { setProjectArtifact, listProjects } from "@/lib/projects";
import { ConfirmModal } from "./components/ConfirmModal";
import { FolderBar } from "./components/FolderBar";
import { AutoTerm } from "./components/AutoTerm";
import { summarizeDiff } from "@/lib/diff";

interface Props {
  /** 어느 작품을 수정하는지 — projects.ts 의 ID */
  projectId: string;
  /** 파일 경로 */
  path: string;
  open: boolean;
  onClose: () => void;
}

type Status = "idle" | "asking" | "applying" | "failed";

export function IterateScreen({ projectId, path, open, onClose }: Props) {
  const qc = useQueryClient();
  const [contents, setContents] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [refreshKey, setRefreshKey] = useState(0); // iframe 강제 새로고침
  const [pendingChange, setPendingChange] = useState<{
    newCode: string;
    note: string;
  } | null>(null);
  const [iterCount, setIterCount] = useState(0);
  const [confirmMd, setConfirmMd] = useState(false);
  const [mdResult, setMdResult] = useState<{
    md: string;
    savedTo: string;
  } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [flashing, setFlashing] = useState(false);

  // 현재 파일 본문 + 스냅샷 + 메타 로드.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void readFile(path).then((c) => {
      if (cancelled) return;
      setContents(c);
      // 첫 자동 스냅샷 — dedupe 로 멱등 (StrictMode 더블 마운트 안전).
      if (c) {
        addSnapshot(path, c, "처음 만들어진 버전", {
          starred: true,
          setActive: true,
          dedupe: true,
        });
      }
      setSnapshots(listSnapshots(path));
    });
    setIterCount(readMeta(path).iterationCount ?? 0);
    return () => {
      cancelled = true;
    };
  }, [open, path]);

  if (!open) return null;

  const askAi = async () => {
    if (!draft.trim()) return;
    setStatus("asking");
    setErrorMsg(null);
    logTerminal({
      kind: "command",
      text: `claude -p (수정 요청: "${draft.slice(0, 60)}")`,
      detail: `현재 코드 ${contents.length} 글자 첨부`,
    });
    // 현재 코드를 자동 첨부 — AI 가 무엇을 수정하는지 알도록.
    const fullPrompt = `다음은 사용자가 만든 페이지의 현재 코드입니다.\n\n\`\`\`html\n${contents}\n\`\`\`\n\n사용자 요청: ${draft.trim()}\n\n전체 파일을 새 버전으로 다시 만들어주세요. 코드만 \`\`\`html ... \`\`\` 으로 감싸서 보내주세요.`;

    try {
      const r = await runClaudePrint(fullPrompt);
      if (!r.success) {
        setStatus("failed");
        setErrorMsg(
          r.claudeMissing
            ? "Claude Code 명령을 못 찾았어요. 데모 모드라면 OK — 가짜 응답이 옵니다."
            : r.stderr || "AI 호출이 실패했어요.",
        );
        return;
      }
      const code = extractCodeBlock(r.stdout);
      if (!code) {
        setStatus("failed");
        setErrorMsg("AI 답변에서 코드를 못 찾았어요. 다시 부탁해주세요.");
        return;
      }
      setPendingChange({ newCode: code, note: draft.trim() });
      setStatus("idle");
    } catch (e) {
      setStatus("failed");
      setErrorMsg(e instanceof Error ? e.message : "오류");
    }
  };

  const applyChange = async () => {
    if (!pendingChange) return;
    setStatus("applying");
    try {
      // 1) 적용 직전 현재 본문을 자동 스냅샷 (활성화 X — 단순 백업).
      addSnapshot(path, contents, "이전 버전 (자동 저장)", { setActive: false });
      // 2) 새 본문 저장.
      const r = await writeFile(path, pendingChange.newCode);
      // 3) 새 스냅샷 추가 + 활성화.
      addSnapshot(path, pendingChange.newCode, pendingChange.note, {
        setActive: true,
      });
      // 4) 프로젝트 파일 경로 갱신.
      setProjectArtifact(projectId, r.path);
      // 5) 이터레이션 카운트 + recent prompts 누적.
      recordIteration(path, pendingChange.note);
      // 6) 상태 갱신.
      setContents(pendingChange.newCode);
      setSnapshots(listSnapshots(path));
      setIterCount(readMeta(path).iterationCount ?? 0);
      setPendingChange(null);
      setDraft("");
      setRefreshKey((k) => k + 1);
      setStatus("idle");
      // 6-b) Artifact 등 다른 화면의 react-query 캐시 무효화.
      void qc.invalidateQueries({ queryKey: ["artifact", path] });
      // 7) 시각적 플래시 — 변화 발생을 사용자가 체감하게.
      setFlashing(true);
      window.setTimeout(() => setFlashing(false), 800);
      logTerminal({
        kind: "success",
        text: `✓ 적용 완료 — "${pendingChange.note}"`,
        detail: `새 본문 ${pendingChange.newCode.length} 글자, 자동 스냅샷 1개 생성`,
      });
    } catch (e) {
      setStatus("failed");
      setErrorMsg(e instanceof Error ? e.message : "저장 실패");
    }
  };

  /** 세션 컨텍스트 MD 저장. */
  const saveSessionMd = async () => {
    setConfirmMd(false);
    const projects = listProjects();
    const proj = projects.find((p) => p.id === projectId);
    const projectLabel = proj?.label ?? "내 작품";
    const recipeId = proj?.recipeId ?? "unknown";
    const md = generateSessionMd({
      projectLabel,
      recipeId,
      path,
      contents,
    });
    // 같은 폴더에 session.md 로 저장 — parentFolder 로 안전 추출.
    const folder = parentFolder(path);
    const mdPath = folder ? `${folder}/session.md` : `${path}.session.md`;
    try {
      const r = await writeFile(mdPath, md);
      markMdSaved(path, false);
      setMdResult({ md, savedTo: r.path });
    } catch (e) {
      setStatus("failed");
      setErrorMsg(e instanceof Error ? e.message : "MD 저장 실패");
    }
  };

  const copyMdToClipboard = async () => {
    if (!mdResult) return;
    try {
      await navigator.clipboard.writeText(mdResult.md);
    } catch {
      /* ignore — fallback 은 사용자가 textarea 에서 직접 복사 */
    }
  };

  const showSwitchBanner =
    iterCount >= SESSION_SWITCH_THRESHOLD && !bannerDismissed;

  const rejectChange = () => setPendingChange(null);

  const [pendingRestore, setPendingRestore] = useState<Snapshot | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Snapshot | null>(null);

  const doRestore = async (snap: Snapshot) => {
    setPendingRestore(null);
    await writeFile(path, snap.contents);
    // 새 "되돌림" 스냅샷이 활성 — setActive(snap.id) 호출 안 함 (활성 ID 가 옛 스냅 가리키는 모순 방지).
    addSnapshot(path, snap.contents, `'${snap.note}' 로 되돌림`, {
      setActive: true,
    });
    setContents(snap.contents);
    setSnapshots(listSnapshots(path));
    setRefreshKey((k) => k + 1);
    void qc.invalidateQueries({ queryKey: ["artifact", path] });
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] bg-bg flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-subtle/15 bg-surface gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-subtle">
              수정 모드 · {iterCount}번째 수정 중
            </p>
            <p className="text-xs font-mono text-ink truncate">{path}</p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmMd(true)}
            title="현재 진행 상황을 MD 로 저장 (새 세션에서 이어가기 위해)"
            className="px-3 py-1.5 rounded-lg bg-surface border border-subtle/20 text-ink text-xs font-medium hover:border-primary/40 shrink-0"
          >
            📄 진행 상황 저장
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-surface border border-subtle/20 text-ink text-xs font-medium hover:border-primary/40 shrink-0"
          >
            ✕ 닫기
          </button>
        </header>

        {/* 폴더 바 — 항상 위쪽에 노출 */}
        <div className="px-5 py-3 border-b border-subtle/10 bg-surface">
          <FolderBar pathOrFolder={path} isFilePath />
        </div>

        {showSwitchBanner && (
          <div className="px-5 py-2.5 bg-warning/15 border-b border-warning/40 flex items-center gap-3">
            <span className="text-lg" aria-hidden>
              💡
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink">
                <AutoTerm>
                  슬슬 토큰이 쌓이고 있어요
                </AutoTerm>{" "}
                ({iterCount}번째 수정). 새 세션으로 바꾸면 답변이 더 빠르고
                정확해져요.
              </p>
              <p className="text-[11px] text-subtle">
                <strong>먼저 📄 진행 상황 저장</strong> 을 눌러 MD 로 받아두세요. 그 다음 새 세션에서 그 MD를 첫 메시지로 붙여넣으면 끝.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmMd(true)}
              className="px-3 py-1.5 rounded-lg bg-warning text-white text-xs font-medium hover:opacity-90 shrink-0"
            >
              📄 지금 저장
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="text-subtle hover:text-ink text-xs"
              aria-label="배너 닫기"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] overflow-hidden">
          {/* 좌측: 미리보기 + 타임라인 */}
          <div className="flex flex-col min-w-0 min-h-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-subtle/10 text-xs">
              <span className="text-subtle">현재 결과</span>
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                className="text-primary hover:underline"
              >
                🔄 새로고침
              </button>
            </div>
            <div className="flex-1 bg-white relative overflow-hidden">
              {/* 플래시 — 적용된 직후 1초 초록 테두리 */}
              {flashing && (
                <div
                  className="pointer-events-none absolute inset-0 z-10 ring-4 ring-success/70 ring-inset animate-pulse"
                  aria-hidden
                />
              )}
              {flashing && (
                <div
                  className="pointer-events-none absolute top-3 right-3 z-20 px-3 py-1.5 rounded-full bg-success text-white text-xs font-semibold shadow"
                  aria-hidden
                >
                  ✓ 적용됨
                </div>
              )}
              {contents ? (
                <iframe
                  key={refreshKey}
                  title="현재 결과 미리보기"
                  srcDoc={contents}
                  sandbox="allow-scripts"
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-subtle text-sm">
                  파일이 비어있어요. 자동 모드로 다시 만들어주세요.
                </div>
              )}
            </div>

            {/* 타임라인 */}
            <div className="border-t border-subtle/15 bg-surface px-4 py-3 max-h-[180px] overflow-y-auto">
              <p className="text-xs font-medium text-subtle mb-2">
                📜 변경 이력 (최근 {snapshots.length}개)
              </p>
              {snapshots.length === 0 ? (
                <p className="text-[11px] text-subtle">
                  아직 변경 이력이 없어요. 첫 수정을 하면 여기에 자동으로 쌓입니다.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {snapshots.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => toggleStar(path, s.id)}
                        className="text-sm"
                        title={s.starred ? "체크포인트 해제" : "⭐ 체크포인트로"}
                      >
                        {s.starred ? "⭐" : "☆"}
                      </button>
                      <span className="text-subtle whitespace-nowrap">
                        {relativeTime(s.createdAt)}
                      </span>
                      <span className="text-ink truncate flex-1">
                        {s.note}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingRestore(s)}
                        className="text-primary hover:underline"
                      >
                        되돌리기
                      </button>
                      {!s.starred && (
                        <button
                          type="button"
                          onClick={() => setPendingDelete(s)}
                          className="text-subtle hover:text-error"
                          title="기록 지우기"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* 우측: AI 챗 패널 */}
          <aside className="flex flex-col bg-surface border-l border-subtle/15">
            <div className="px-4 py-3 border-b border-subtle/10">
              <p className="text-[10px] uppercase tracking-wide text-subtle">
                AI 한테 부탁하기
              </p>
              <h3 className="text-sm font-semibold text-ink">
                뭘 바꾸고 싶어요?
              </h3>
              <p className="text-[11px] text-subtle mt-1">
                현재 코드를 자동으로 같이 보내드려요. 입문자 친화 — 한 줄로 부탁하면 돼요.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {/* 추천 프롬프트 */}
              {!pendingChange && status === "idle" && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-subtle">예시:</p>
                  {[
                    "배경색을 분홍색으로 바꿔줘",
                    "사진 자리를 하나 더 추가해줘",
                    "글씨를 더 크게 해줘",
                    "버튼 하나 추가해줘 — 클릭하면 alert 떠야 해",
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDraft(s)}
                      className="w-full text-left text-xs px-3 py-1.5 rounded-lg bg-bg border border-subtle/15 hover:border-primary/30 text-subtle hover:text-ink"
                    >
                      💡 {s}
                    </button>
                  ))}
                </div>
              )}

              {/* 진행 상태 */}
              {status === "asking" && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm text-ink">
                  ⏳ AI에게 보내는 중... (현재 코드 + 요청 첨부)
                </div>
              )}

              {/* 변경 미리보기 (적용 전) */}
              {pendingChange && (
                <PendingChangeCard
                  pending={pendingChange}
                  current={contents}
                  applying={status === "applying"}
                  onApply={() => void applyChange()}
                  onReject={rejectChange}
                />
              )}

              {status === "failed" && errorMsg && (
                <div className="rounded-xl bg-warning/10 border border-warning/30 p-3">
                  <p className="text-sm font-medium text-ink mb-1">
                    😕 잠깐 멈췄어요
                  </p>
                  <p className="text-[11px] text-subtle mb-2">{errorMsg}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("idle");
                      setErrorMsg(null);
                    }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    다시 시도
                  </button>
                </div>
              )}
            </div>

            {/* 입력창 */}
            <div className="px-3 py-3 border-t border-subtle/10">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void askAi();
                  }
                }}
                placeholder="예: 배경색을 분홍색으로 바꿔줘"
                disabled={status === "asking" || !!pendingChange}
                className="w-full min-h-[70px] resize-none rounded-xl border border-subtle/20 px-3 py-2 text-sm bg-bg focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[10px] text-subtle">
                  Enter 보내기 · Shift+Enter 줄바꿈
                </p>
                <button
                  type="button"
                  onClick={() => void askAi()}
                  disabled={!draft.trim() || status === "asking" || !!pendingChange}
                  className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50"
                >
                  🤖 AI에게 부탁
                </button>
              </div>
            </div>
          </aside>
        </div>

        <ConfirmModal
          open={!!pendingRestore}
          title={
            pendingRestore
              ? `"${pendingRestore.note}" 버전으로 되돌릴까요?`
              : ""
          }
          message="이 버전의 본문을 현재로 복구합니다. 지금 본문은 자동으로 백업 스냅샷이 만들어져요."
          safeNote="기존 작업이 사라지지 않아요. 언제든 또 다른 버전으로 되돌릴 수 있어요."
          confirmLabel="되돌리기"
          onConfirm={() => {
            if (pendingRestore) void doRestore(pendingRestore);
          }}
          onCancel={() => setPendingRestore(null)}
        />

        <ConfirmModal
          open={!!pendingDelete}
          title="이 버전 기록을 지울까요?"
          message={
            pendingDelete
              ? `"${pendingDelete.note}" 기록만 사라집니다. 실제 파일이나 다른 버전은 그대로예요.`
              : ""
          }
          danger
          confirmLabel="지우기"
          onConfirm={() => {
            if (pendingDelete) {
              deleteSnapshot(path, pendingDelete.id);
              setSnapshots(listSnapshots(path));
            }
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />

        <ConfirmModal
          open={confirmMd}
          title="진행 상황을 MD 로 저장할게요"
          message="현재 코드 + 변경 이력 + 최근 AI 요청을 한 파일로 묶어 같은 폴더에 session.md 로 저장합니다. 새 Claude 세션에서 이걸 첫 메시지로 붙여넣으면 그대로 이어갈 수 있어요."
          safeNote="기존 작업 안 건드립니다. session.md 한 파일만 새로 만들어요."
          confirmLabel="저장"
          onConfirm={() => void saveSessionMd()}
          onCancel={() => setConfirmMd(false)}
        />

        {mdResult && (
          <SavedMdModal
            md={mdResult.md}
            savedTo={mdResult.savedTo}
            onClose={() => setMdResult(null)}
            onCopy={() => void copyMdToClipboard()}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function PendingChangeCard({
  pending,
  current,
  applying,
  onApply,
  onReject,
}: {
  pending: { newCode: string; note: string };
  current: string;
  applying: boolean;
  onApply: () => void;
  onReject: () => void;
}) {
  const summary = summarizeDiff(current, pending.newCode);
  const delta = summary.charsAfter - summary.charsBefore;

  return (
    <div className="rounded-xl bg-success/5 border border-success/30 p-3">
      <p className="text-sm font-medium text-ink mb-1">
        ✓ AI가 새 버전을 만들어왔어요
      </p>
      <p className="text-[11px] text-subtle mb-2">"{pending.note}"</p>

      {/* 변화 요약 — 입문자가 "진짜 바뀌었나" 검증할 핵심 정보 */}
      <div
        className={`rounded-lg p-2 mb-3 border ${
          summary.identical
            ? "bg-warning/10 border-warning/30"
            : "bg-bg border-subtle/15"
        }`}
      >
        <p className="text-[10px] text-subtle mb-1">📊 변화 요약</p>
        <p className="text-[11px] text-ink mb-1.5 font-mono">
          전: {summary.charsBefore.toLocaleString()}자 / {summary.linesBefore}줄
          {"  →  "}
          후: {summary.charsAfter.toLocaleString()}자 / {summary.linesAfter}줄
          <span
            className={`ml-1 font-semibold ${
              delta > 0 ? "text-success" : delta < 0 ? "text-warning" : "text-subtle"
            }`}
          >
            ({delta > 0 ? "+" : ""}
            {delta}자)
          </span>
        </p>
        <ul className="text-[11px] space-y-0.5">
          {summary.changes.map((c, i) => (
            <li key={i} className="text-ink/90">
              {c}
            </li>
          ))}
        </ul>
      </div>

      <details className="mb-3">
        <summary className="text-[11px] text-primary cursor-pointer">
          코드 보기 ({pending.newCode.length} 글자)
        </summary>
        <pre className="mt-1.5 text-[10px] font-mono bg-bg rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
          {pending.newCode.slice(0, 800)}
          {pending.newCode.length > 800 ? "\n..." : ""}
        </pre>
      </details>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onApply}
          disabled={applying}
          className="flex-1 px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {applying ? "저장 중..." : "✓ 적용하기"}
        </button>
        <button
          type="button"
          onClick={onReject}
          className="px-3 py-2 rounded-lg bg-surface border border-subtle/20 text-xs hover:border-error/40"
        >
          ✕ 거부
        </button>
      </div>
    </div>
  );
}

function SavedMdModal({
  md,
  savedTo,
  onClose,
  onCopy,
}: {
  md: string;
  savedTo: string;
  onClose: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-surface border border-subtle/15 shadow-xl flex flex-col max-h-[85vh]">
        <header className="px-5 py-4 border-b border-subtle/10">
          <p className="text-3xl mb-1" aria-hidden>
            ✓
          </p>
          <h2 className="text-lg font-semibold text-ink">
            저장됐어요. 이제 새 세션 가능
          </h2>
          <p className="text-xs text-subtle mt-1 font-mono truncate">
            📁 {savedTo}
          </p>
        </header>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          <h3 className="text-sm font-semibold text-ink mb-2">
            새 Claude 세션에서 어떻게 이어가는지
          </h3>
          <ol className="text-sm text-ink/90 space-y-2 mb-4 list-decimal list-inside">
            <li>
              Claude.ai (또는 Claude Code) 에서 <strong>새 대화</strong> 시작
            </li>
            <li>
              아래 박스 안 글 전체를 복사해서 <strong>첫 메시지</strong>로 붙여넣기
            </li>
            <li>그 다음 줄에 진짜 부탁 입력 (예: "사진 한 장 더 추가해줘")</li>
            <li>새 세션이 이전 흐름을 다 알고 답합니다 — 토큰 절약 ✓</li>
          </ol>
          <button
            type="button"
            onClick={onCopy}
            className="w-full mb-3 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90"
          >
            📋 MD 전체 클립보드에 복사
          </button>
          <details>
            <summary className="text-xs text-subtle cursor-pointer mb-2">
              MD 본문 미리 보기
            </summary>
            <pre className="text-[10px] font-mono bg-bg rounded-lg p-3 max-h-64 overflow-auto whitespace-pre-wrap">
              {md.slice(0, 1500)}
              {md.length > 1500 ? "\n... (이후 생략 — 전체는 위 복사 버튼 사용)" : ""}
            </pre>
          </details>
        </div>

        <footer className="px-5 py-3 border-t border-subtle/10 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface border border-subtle/20 text-sm hover:border-primary/40"
          >
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
}

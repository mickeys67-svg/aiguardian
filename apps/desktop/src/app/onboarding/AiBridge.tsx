// [7] AI 다리 — TG 가 만든 빈 프로젝트 → Claude Code → 코드 받기 → 파일 저장.
// 입문자에게 가장 어려운 1마일을 3단계로 쪼갠 화면.

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listRecipes,
  writeFile,
  runClaudePrint,
  extractCodeBlock,
  installClaudeCode,
} from "@/lib/tauri";
import { useApp } from "../state";
import { Coachmark } from "../components/Coachmark";
import { ConfirmModal } from "../components/ConfirmModal";
import { FolderBar } from "../components/FolderBar";
import { AutoTerm } from "../components/AutoTerm";
import { globalTipQueue } from "@tg/tip-engine";
import { logTerminal } from "@/lib/terminalLog";

type SubStep = "prompt" | "open" | "receive";
type AiPath = "claude_code" | "claude_web" | "claude_desktop";
type Mode = "auto" | "manual";
type AutoStep = "idle" | "asking" | "extracting" | "saving" | "done" | "failed";

export function AiBridge() {
  const { data: recipes } = useQuery({
    queryKey: ["recipes"],
    queryFn: listRecipes,
  });
  const selectedId = useApp((s) => s.selectedRecipeId);
  const setArtifactPath = useApp((s) => s.setArtifactPath);
  const next = useApp((s) => s.next);

  const recipe = useMemo(
    () =>
      recipes?.find((r) => r.id === selectedId) ?? recipes?.[0] ?? null,
    [recipes, selectedId],
  );

  const [sub, setSub] = useState<SubStep>("prompt");
  const [promptText, setPromptText] = useState("");
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [aiPath, setAiPath] = useState<AiPath>("claude_web"); // 기본을 가장 쉬운 웹으로
  const [mode, setMode] = useState<Mode>("auto"); // ★ 새 자동/수동 토글
  const [autoStep, setAutoStep] = useState<AutoStep>("idle");
  const [autoError, setAutoError] = useState<string | null>(null);
  const [claudeMissing, setClaudeMissing] = useState(false);
  const [installing, setInstalling] = useState(false);

  // recipe 가 새로 도착했고 사용자가 아직 편집 안 했을 때만 템플릿 채움.
  const promptInitializedRef = useRef(false);
  useEffect(() => {
    if (recipe?.promptTemplate && !promptInitializedRef.current) {
      setPromptText(recipe.promptTemplate);
      promptInitializedRef.current = true;
    }
  }, [recipe?.promptTemplate]);

  if (!recipe) {
    return (
      <p className="text-center text-subtle text-sm">
        레시피를 불러오는 중이에요...
      </p>
    );
  }

  const targetPath = `~/projects/${recipe.id}/index.html`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      globalTipQueue.enqueue({
        id: `aibridge-copied-${Date.now()}`,
        pattern: "해석형",
        trigger: "상태",
        priority: 2,
        message: "✓ 복사됐어요. 이제 Claude Code 창을 열고 붙여넣으세요.",
        ttlMs: 5000,
      });
    } catch {
      globalTipQueue.enqueue({
        id: `aibridge-copy-fail-${Date.now()}`,
        pattern: "위로형",
        trigger: "상태",
        priority: 2,
        message: "복사가 막혔어요. 박스 안 글을 직접 선택해서 복사해주세요.",
        ttlMs: 8000,
      });
    }
  };

  const [openHelp, setOpenHelp] = useState(false);

  const handleOpenClaudeCode = async () => {
    // 1) URL 스킴 시도 → 2) shell 명령 시도 → 3) 도움말 모달.
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open("claude://");
      return;
    } catch {
      /* 다음 시도 */
    }
    try {
      const { Command } = await import("@tauri-apps/plugin-shell");
      const cmd = Command.create("claude", []);
      await cmd.spawn();
      return;
    } catch {
      /* 폴백 */
    }
    setOpenHelp(true);
  };

  const handleSave = async () => {
    if (!response.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const r = await writeFile(targetPath, response);
      setArtifactPath(r.path, recipe.title);
      next(); // → artifact 화면
    } catch (e) {
      setSaveError(
        typeof e === "string" ? e : (e as Error).message ?? "저장이 실패했어요.",
      );
    } finally {
      setSaving(false);
    }
  };

  /** 자동 모드: claude -p → 코드 추출 → 파일 저장 → Artifact. */
  const runAuto = async () => {
    setAutoError(null);
    setAutoStep("asking");
    logTerminal({
      kind: "command",
      text: `claude -p "${promptText.slice(0, 60)}${promptText.length > 60 ? "..." : ""}"`,
      detail: `(자동 모드 — ${promptText.length} 글자 prompt)`,
    });
    try {
      const r = await runClaudePrint(promptText);
      if (!r.success) {
        setAutoStep("failed");
        setClaudeMissing(!!r.claudeMissing);
        const msg = r.claudeMissing
          ? "Claude Code 가 컴퓨터에 안 깔려있어요. 아래 '한 번 클릭으로 깔기' 시도해보거나 수동 모드로 가실 수 있어요."
          : r.stderr || "AI 호출이 실패했어요. 수동 모드로 가주세요.";
        setAutoError(msg);
        logTerminal({ kind: "stderr", text: msg });
        return;
      }
      setClaudeMissing(false);
      logTerminal({
        kind: "ai",
        text: `AI 답변 도착 — ${r.stdout.length} 글자`,
      });
      setAutoStep("extracting");
      await new Promise((res) => setTimeout(res, 350));
      const code = extractCodeBlock(r.stdout);
      if (!code) {
        setAutoStep("failed");
        const msg =
          "AI 답변에서 코드를 못 찾았어요. 수동 모드에서 직접 골라 붙여넣어 주세요.";
        setAutoError(msg);
        logTerminal({ kind: "stderr", text: msg });
        return;
      }
      logTerminal({ kind: "info", text: `코드 추출 — ${code.length} 글자` });
      setAutoStep("saving");
      await new Promise((res) => setTimeout(res, 250));
      const saved = await writeFile(targetPath, code);
      logTerminal({
        kind: "success",
        text: "✓ 파일 저장",
        detail: saved.path,
      });
      setArtifactPath(saved.path, recipe.title);
      setAutoStep("done");
      await new Promise((res) => setTimeout(res, 600));
      next();
    } catch (e) {
      setAutoStep("failed");
      const msg =
        typeof e === "string" ? e : (e as Error).message ?? "처리 중 오류";
      setAutoError(msg);
      logTerminal({ kind: "error", text: `자동 모드 예외: ${msg}` });
    }
  };

  const switchToManual = () => {
    setMode("manual");
    setAutoStep("idle");
    setAutoError(null);
  };

  const handleInstallClaude = async () => {
    setInstalling(true);
    logTerminal({ kind: "command", text: "Claude Code 자동 설치 시도..." });
    try {
      const r = await installClaudeCode();
      if (r.success) {
        logTerminal({
          kind: "success",
          text: `✓ Claude Code 설치 완료 (${r.method})`,
        });
        setClaudeMissing(false);
        setAutoError(null);
        setAutoStep("idle");
      } else {
        // stderr 그대로 노출 + 관리자 권한 가설 추가.
        const rawErr = (r.stderr || r.stdout || "").trim();
        const needsAdmin = /access is denied|denied|requires admin|elevation|관리자/i.test(rawErr);
        const wingetMissing = /'winget'|cannot find|not recognized|찾을 수 없|아닙니다/i.test(rawErr);
        let friendly =
          "자동 설치가 실패했어요. claude.ai/download 에서 직접 설치하거나 수동 모드로 가주세요.";
        if (needsAdmin) {
          friendly =
            "관리자 권한이 필요해요. PowerShell 을 '관리자로 실행' 으로 켠 뒤 다시 시도해주세요. 또는 claude.ai/download 에서 설치 파일 받아 직접 실행.";
        } else if (wingetMissing) {
          friendly =
            "winget 이 이 컴퓨터에 없어요 (구버전 Windows 일 수 있어요). claude.ai/download 에서 직접 설치해주세요.";
        }
        logTerminal({
          kind: "stderr",
          text: `설치 실패 (${r.method})`,
          detail: rawErr || "(stderr 비어있음)",
        });
        setAutoError(`${friendly}\n\n원본 메시지: ${rawErr.slice(0, 200) || "(비어있음)"}`);
      }
    } catch (e) {
      logTerminal({
        kind: "error",
        text: `설치 예외: ${e instanceof Error ? e.message : "오류"}`,
      });
    } finally {
      setInstalling(false);
    }
  };

  const looksLikeCode = response.length > 30 && /[<>{};]/.test(response);

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl w-full px-6 py-10"
    >
      <header className="mb-5">
        <p className="text-xs text-subtle mb-1">
          {recipe.title} · 마지막 단계
        </p>
        <h2 className="text-2xl font-semibold text-ink mb-2">
          🤖 AI한테 코드 받아올게요
        </h2>
        <ProgressDots current={sub} />
      </header>

      {/* 폴더 정보 — 항상 보임 */}
      <div className="mb-5">
        <FolderBar
          pathOrFolder={targetPath}
          isFilePath
          hint="이 폴더에 만들어진 파일이 자동으로 들어가요. 손으로 사진을 넣고 싶으면 이 폴더에 드래그하세요."
        />
      </div>

      {sub === "prompt" && (
        <div className="space-y-5">
          {/* 자동/수동 토글 */}
          <div className="flex justify-center gap-1" role="tablist">
            <ModeBtn
              active={mode === "auto"}
              onClick={() => setMode("auto")}
              label="🚀 자동 모드"
              hint="추천"
            />
            <ModeBtn
              active={mode === "manual"}
              onClick={() => setMode("manual")}
              label="🛠 수동 모드"
              hint="복사·붙여넣기 직접"
            />
          </div>

          <Numbered n={1} title="이 메시지를 AI 한테 보낼게요">
            <p className="text-xs text-subtle mb-2">
              {mode === "auto"
                ? "복사·붙여넣기는 제가 다 해드려요. 메시지만 확인해주세요."
                : "이 글을 직접 복사해서 Claude.ai 같은 곳에 붙여넣으면 코드를 받을 수 있어요."}{" "}
              <strong>{"{{ }}"}</strong> 가 보이면 자기 정보로 바꿔보세요 (안 바꿔도 동작해요).
            </p>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              disabled={autoStep !== "idle" && autoStep !== "failed"}
              className="w-full min-h-[140px] rounded-xl border border-subtle/20 px-3 py-2 text-sm bg-bg font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
            <p className="text-[10px] text-subtle mt-1">
              ✏️ 예: <code>{"{{name}}"}</code> 를 자기 이름으로. 그대로 둬도 동작해요.
            </p>
          </Numbered>

          {mode === "auto" ? (
            <AutoPanel
              autoStep={autoStep}
              autoError={autoError}
              claudeMissing={claudeMissing}
              installing={installing}
              onRun={runAuto}
              onSwitchManual={switchToManual}
              onInstallClaude={handleInstallClaude}
            />
          ) : (
            <>
              <Coachmark
                id="aibridge-prompt-copy"
                anchor="[data-coach='copy-btn']"
                screenId="aibridge"
                title="이 버튼이 핵심이에요"
                body="한 번 누르면 AI한테 보낼 메시지가 클립보드에 담겨요."
              />

              <Numbered n={2} title="Claude.ai 또는 Claude Code 에 붙여넣으면">
                <p className="text-xs text-subtle">
                  다음 화면에서 같이 열어볼게요.
                </p>
              </Numbered>

              <Numbered n={3} title="AI가 코드를 만들어줘요">
                <p className="text-xs text-subtle">
                  완성되면 그 코드를 받아 저장할 거예요.
                </p>
              </Numbered>

              <div className="flex gap-2">
                <button
                  type="button"
                  data-coach="copy-btn"
                  onClick={handleCopy}
                  className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-medium shadow-sm hover:opacity-90"
                >
                  📋 복사하기
                </button>
                <button
                  type="button"
                  onClick={() => setSub("open")}
                  className="px-4 py-3 rounded-xl bg-surface border border-subtle/20 text-sm hover:border-primary/40"
                >
                  다음 →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {sub === "open" && (
        <div className="space-y-5">
          <section className="rounded-2xl bg-primary/5 border border-primary/20 p-4">
            <h3 className="font-semibold text-ink text-sm mb-2">
              어디서 AI한테 부탁할까요?
            </h3>
            <p className="text-xs text-subtle mb-3">
              세 가지 방법이 있어요. 처음이시면 ⭐ 추천 으로 가세요.
            </p>
            <div className="space-y-2">
              <PathRadio
                value="claude_web"
                current={aiPath}
                onChange={setAiPath}
                title="⭐ Claude.ai (웹브라우저)"
                hint="설치 0개. 로그인만 하면 끝. ChatGPT 처럼 채팅창에 붙여넣기."
              />
              <PathRadio
                value="claude_desktop"
                current={aiPath}
                onChange={setAiPath}
                title="Claude Desktop 앱"
                hint="앱 한 번만 깔면 됩니다. 채팅창 동일."
              />
              <PathRadio
                value="claude_code"
                current={aiPath}
                onChange={setAiPath}
                title="Claude Code (터미널)"
                hint="개발자용. 까만 창에서 동작. 익숙하지 않으면 위 두 개를 추천."
              />
            </div>
          </section>

          {aiPath === "claude_web" && <ClaudeWebGuide />}
          {aiPath === "claude_desktop" && <ClaudeDesktopGuide />}
          {aiPath === "claude_code" && (
            <ClaudeCodeGuide onOpenClaude={handleOpenClaudeCode} />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSub("prompt")}
              className="px-4 py-2.5 rounded-xl bg-surface border border-subtle/20 text-sm text-subtle hover:text-ink"
            >
              ← 메시지 다시 보기
            </button>
            <button
              type="button"
              onClick={() => setSub("receive")}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:opacity-90"
            >
              네, AI한테 받았어요. 다음 →
            </button>
          </div>
        </div>
      )}

      {sub === "receive" && (
        <div className="space-y-5">
          <Numbered n={1} title="AI가 준 코드를 여기 붙여넣으세요">
            <p className="text-xs text-subtle mb-2">
              아까 복사한 코드(Claude.ai 라면 <strong>Copy 버튼</strong>으로,
              터미널이라면 <kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">Shift</kbd>+<kbd className="kbd">C</kbd>로
              복사한 거)를 아래 박스에 붙여넣으면 돼요.
            </p>
            <ol className="text-xs text-subtle space-y-1 mb-2 leading-relaxed">
              <li>① 아래 박스 한 번 클릭</li>
              <li>② <kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">V</kbd> 로 붙여넣기</li>
            </ol>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="여기 클릭하고 Ctrl+V"
              className={`w-full min-h-[200px] rounded-xl border px-3 py-2 text-sm bg-bg font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                looksLikeCode
                  ? "border-success/40"
                  : response.length > 0
                    ? "border-warning/40"
                    : "border-subtle/20"
              }`}
            />
            {response.length > 0 && (
              <p
                className={`text-[10px] mt-1 ${
                  looksLikeCode ? "text-success" : "text-warning"
                }`}
              >
                {looksLikeCode
                  ? "✓ 코드 같네요. 저장 가능해요."
                  : "⚠️ 이건 코드가 아닌 것 같아요. 다시 확인해 주세요."}
              </p>
            )}
          </Numbered>

          {saveError && (
            <div className="rounded-xl bg-warning/10 border border-warning/30 p-3 text-sm text-ink">
              <p className="font-medium mb-1">⚠️ 저장이 막혔어요</p>
              <p className="text-xs text-subtle">{saveError}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSub("open")}
              className="px-4 py-2.5 rounded-xl bg-surface border border-subtle/20 text-sm text-subtle hover:text-ink"
            >
              ← 이전
            </button>
            <button
              type="button"
              onClick={() => setConfirmSave(true)}
              disabled={!response.trim() || saving}
              className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "💾 이걸 파일로 저장할게요"}
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmSave}
        title="이 코드를 파일로 저장할게요"
        message={`다음 위치에 저장됩니다:\n${targetPath}`}
        safeNote="당신의 홈 폴더 안에서만 작업해요. 다른 곳은 안 건드려요."
        confirmLabel="저장"
        onConfirm={async () => {
          setConfirmSave(false);
          await handleSave();
        }}
        onCancel={() => setConfirmSave(false)}
      />

      <ConfirmModal
        open={openHelp}
        title="Claude Code 가 안 떠요"
        message="안 깔려있을 수 있어요. 두 가지로 계속할 수 있어요."
        safeNote="이미 깔려있다면 직접 켜고 다음 단계로 넘어가세요."
        confirmLabel="설치 페이지 열기"
        cancelLabel="직접 켰어요, 닫기"
        onConfirm={async () => {
          setOpenHelp(false);
          try {
            const { open } = await import("@tauri-apps/plugin-shell");
            await open("https://claude.ai/download");
          } catch {
            /* ignore */
          }
        }}
        onCancel={() => setOpenHelp(false)}
      />
    </motion.section>
  );
}

function ModeBtn({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 max-w-[180px] px-4 py-2 rounded-xl text-sm transition ${
        active
          ? "bg-primary text-white shadow"
          : "bg-surface border border-subtle/15 text-subtle hover:text-ink"
      }`}
    >
      <span className="block font-medium">{label}</span>
      <span className={`block text-[10px] ${active ? "text-white/80" : "text-subtle/80"}`}>
        {hint}
      </span>
    </button>
  );
}

function AutoPanel({
  autoStep,
  autoError,
  claudeMissing,
  installing,
  onRun,
  onSwitchManual,
  onInstallClaude,
}: {
  autoStep: AutoStep;
  autoError: string | null;
  claudeMissing: boolean;
  installing: boolean;
  onRun: () => void;
  onSwitchManual: () => void;
  onInstallClaude: () => void;
}) {
  const stepText: Record<AutoStep, string> = {
    idle: "준비 완료",
    asking: "AI한테 메시지 보내는 중...",
    extracting: "답변에서 코드 골라내는 중...",
    saving: "파일로 저장하는 중...",
    done: "✓ 완료! 결과 화면으로 이동...",
    failed: "잠깐 멈췄어요",
  };
  const busy =
    autoStep === "asking" || autoStep === "extracting" || autoStep === "saving";

  return (
    <section className="rounded-2xl bg-primary/5 border border-primary/20 p-5">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl" aria-hidden>
          🚀
        </span>
        <div className="flex-1">
          <h3 className="font-semibold text-ink text-sm">
            제가 다 해드릴게요
          </h3>
          <p className="text-xs text-subtle mt-0.5">
            메시지 보내기 → 답변 받기 → 코드 추출 → 파일 저장 — 전부 한 번에.
            <br />
            복사·붙여넣기 안 하셔도 됩니다.
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {autoStep === "idle" && (
          <motion.button
            key="idle"
            type="button"
            onClick={onRun}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full px-4 py-3 rounded-xl bg-primary text-white font-medium shadow-sm hover:opacity-90"
          >
            🤖 AI한테 자동으로 받아올게요
          </motion.button>
        )}

        {busy && (
          <motion.div
            key="busy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2.5"
          >
            <ProgressLine label="AI 한테 보냄" active={autoStep === "asking"} done={autoStep !== "asking"} />
            <ProgressLine label="답변에서 코드 추출" active={autoStep === "extracting"} done={autoStep === "saving"} />
            <ProgressLine label="파일로 저장" active={autoStep === "saving"} done={false} />
          </motion.div>
        )}

        {autoStep === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-3"
          >
            <p className="text-2xl mb-1" aria-hidden>
              ✓
            </p>
            <p className="text-sm text-success font-medium">{stepText.done}</p>
          </motion.div>
        )}

        {autoStep === "failed" && (
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl bg-warning/10 border border-warning/30 p-3"
          >
            <p className="text-sm font-medium text-ink mb-1">😕 자동 모드가 막혔어요</p>
            <p className="text-xs text-subtle mb-3">
              {autoError ?? "다시 시도하거나 수동 모드로 가주세요."}
            </p>
            {claudeMissing && (
              <div className="rounded-lg bg-primary/5 border border-primary/30 p-2.5 mb-3">
                <p className="text-xs font-medium text-ink mb-1.5">
                  🚀 Claude Code 를 한 번에 깔아드릴까요?
                </p>
                <p className="text-[11px] text-subtle mb-2">
                  winget (Windows) 또는 npm 으로 자동 설치 시도해요. 약 2~5분 걸려요.
                </p>
                <button
                  type="button"
                  onClick={onInstallClaude}
                  disabled={installing}
                  className="w-full px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {installing ? "깔고 있어요..." : "한 번 클릭으로 깔기"}
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onRun}
                className="flex-1 px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:opacity-90"
              >
                🔄 다시 시도
              </button>
              <button
                type="button"
                onClick={onSwitchManual}
                className="flex-1 px-3 py-2 rounded-lg bg-surface border border-subtle/20 text-xs hover:border-primary/40"
              >
                🛠 수동 모드로
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {autoStep === "idle" && (
        <p className="text-[10px] text-subtle text-center mt-2">
          💡 데모 모드에선 가짜 코드가 와요. 실제 동작은 데스크톱 앱에서.
        </p>
      )}
    </section>
  );
}

function ProgressLine({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`w-5 h-5 flex items-center justify-center text-xs ${
          done ? "text-success" : active ? "text-primary" : "text-subtle/40"
        }`}
      >
        {done ? "✓" : active ? "⏳" : "○"}
      </span>
      <span
        className={`text-sm ${
          done ? "text-ink line-through opacity-60" : active ? "text-ink font-medium" : "text-subtle/60"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function ProgressDots({ current }: { current: SubStep }) {
  const order: SubStep[] = ["prompt", "open", "receive"];
  return (
    <div className="flex items-center gap-1.5">
      {order.map((s) => (
        <span
          key={s}
          className={`h-1.5 rounded-full transition-all ${
            s === current
              ? "w-8 bg-primary"
              : order.indexOf(s) < order.indexOf(current)
                ? "w-4 bg-primary/40"
                : "w-4 bg-subtle/30"
          }`}
        />
      ))}
    </div>
  );
}

function Numbered({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-surface border border-subtle/15 p-4">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
          {n}
        </span>
        <h3 className="font-semibold text-ink text-sm">{title}</h3>
      </div>
      <div className="pl-9">{children}</div>
    </section>
  );
}

function PathRadio({
  value,
  current,
  onChange,
  title,
  hint,
}: {
  value: AiPath;
  current: AiPath;
  onChange: (v: AiPath) => void;
  title: string;
  hint: string;
}) {
  const active = value === current;
  return (
    <label
      className={`flex items-start gap-3 px-3 py-2 rounded-xl cursor-pointer border transition ${
        active
          ? "border-primary bg-primary/10"
          : "border-subtle/15 hover:border-subtle/30 bg-surface"
      }`}
    >
      <input
        type="radio"
        checked={active}
        onChange={() => onChange(value)}
        className="mt-1 text-primary focus:ring-primary/40"
      />
      <span className="flex-1">
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="block text-[11px] text-subtle">{hint}</span>
      </span>
    </label>
  );
}

async function openExternal(url: string) {
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

function ClaudeWebGuide() {
  return (
    <div className="space-y-3">
      <Numbered n={1} title="Claude.ai 를 여세요">
        <p className="text-xs text-subtle mb-2">
          처음이면 가입(이메일 + 비밀번호) 한 번만 하면 끝나요. 무료예요.
        </p>
        <button
          type="button"
          onClick={() => void openExternal("https://claude.ai")}
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90"
        >
          🌐 Claude.ai 열기
        </button>
      </Numbered>

      <Numbered n={2} title="채팅창에 붙여넣고 보내세요">
        <p className="text-xs text-subtle mb-2">
          ChatGPT 와 똑같이 생긴 화면이에요. 가운데 큰 입력창이 있어요.
        </p>
        <div className="rounded-xl bg-bg border border-subtle/20 p-3 text-[11px]">
          <p className="font-medium text-ink mb-1.5">이렇게 보여요:</p>
          <div className="rounded-lg border border-subtle/30 bg-surface p-2 space-y-1.5">
            <div className="text-subtle">Claude</div>
            <div className="border-t border-subtle/15 pt-1.5">
              <div className="rounded bg-bg px-2 py-1 text-subtle italic">
                Reply to Claude...
              </div>
              <div className="flex justify-end mt-1">
                <span className="text-[10px] text-subtle">↑ Send</span>
              </div>
            </div>
          </div>
        </div>
        <ol className="text-xs text-subtle space-y-1 mt-2 leading-relaxed">
          <li>① 위 입력창 클릭</li>
          <li>② <kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">V</kbd> 로 메시지 붙여넣기</li>
          <li>③ ↑ 버튼 클릭 또는 <kbd className="kbd">Enter</kbd></li>
          <li>④ AI가 30초~1분 글 쓰는 거 기다리기</li>
        </ol>
      </Numbered>

      <Numbered n={3} title="답변에서 코드 복사하세요">
        <p className="text-xs text-subtle mb-2">
          AI 답변 안에 회색 박스(코드 블록)이 떠요. 박스 우상단 <strong>Copy</strong> 버튼을
          누르면 코드 전체가 한 번에 복사돼요.
        </p>
        <div className="rounded-xl bg-bg border border-subtle/20 p-3 text-[11px]">
          <div className="rounded-lg bg-ink/95 text-white/90 p-2 font-mono leading-relaxed relative">
            <button
              type="button"
              disabled
              className="absolute top-1.5 right-1.5 text-[10px] bg-white/10 px-2 py-0.5 rounded"
            >
              📋 Copy
            </button>
            <div>&lt;!DOCTYPE html&gt;</div>
            <div>&lt;html&gt;</div>
            <div>&nbsp;&nbsp;&lt;head&gt;...</div>
            <div className="text-white/40">↑ 이 박스의 Copy 버튼을 누르세요</div>
          </div>
        </div>
      </Numbered>
    </div>
  );
}

function ClaudeDesktopGuide() {
  return (
    <div className="space-y-3">
      <Numbered n={1} title="Claude Desktop 앱을 여세요">
        <p className="text-xs text-subtle mb-2">
          시작 메뉴에서 <strong>Claude</strong> 를 검색해서 켜세요. 안 깔려있으면 깔러 가기.
        </p>
        <button
          type="button"
          onClick={() => void openExternal("https://claude.ai/download")}
          className="text-xs px-3 py-1.5 rounded-lg bg-surface border border-subtle/20 hover:border-primary/40"
        >
          깔러 가기 →
        </button>
      </Numbered>
      <Numbered n={2} title="새 대화창에 붙여넣고 Enter">
        <ol className="text-xs text-subtle space-y-1 leading-relaxed">
          <li>① 좌상단 ✏️ "New chat" 클릭</li>
          <li>② 입력창 클릭 → <kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">V</kbd></li>
          <li>③ <kbd className="kbd">Enter</kbd></li>
          <li>④ 답변의 코드 박스 → <strong>Copy</strong> 버튼</li>
        </ol>
      </Numbered>
    </div>
  );
}

function ClaudeCodeGuide({ onOpenClaude }: { onOpenClaude: () => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-warning/5 border border-warning/30 p-3 text-xs text-ink">
        ⚠️ <AutoTerm>Claude Code 는 까만 터미널 창에서 동작해요.</AutoTerm> 글자만 입력해서 부탁하는
        방식이라 처음엔 어려울 수 있어요. <strong>잘 모르겠으면 위에서 'Claude.ai (웹)'을 골라주세요.</strong>
      </div>

      <Numbered n={1} title="터미널 창에서 claude 를 시작하세요">
        <p className="text-xs text-subtle mb-2">
          <AutoTerm>제가 PowerShell 창을 열어드릴게요.</AutoTerm> 그 창에서{" "}
          <strong>딱 한 번</strong>{" "}
          <code className="font-mono bg-bg px-1 rounded">claude</code> 라고 치고 Enter 만 누르면 돼요.
        </p>
        <button
          type="button"
          onClick={onOpenClaude}
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90"
        >
          🚀 PowerShell 열기
        </button>
      </Numbered>

      <Numbered n={2} title="이렇게 보여요 — 입력창 모양 익히기">
        <div className="rounded-xl bg-ink/95 text-white/90 p-3 font-mono text-[11px] leading-relaxed">
          <div className="text-emerald-300">&gt; Welcome to Claude Code</div>
          <div className="text-white/50">  /help for help, /status for status</div>
          <div className="mt-2 text-white/70">cwd: ~/projects/tg-webpage</div>
          <div className="mt-3 border border-white/30 rounded p-1.5">
            <span className="text-emerald-300">│ </span>
            <span className="text-white/40 italic">여기에 메시지를 입력하세요</span>
          </div>
        </div>
        <p className="text-[11px] text-subtle mt-1.5">
          📦 박스 안에 깜박이는 자리가 입력창이에요.
        </p>
      </Numbered>

      <Numbered n={3} title="메시지 붙여넣기 → Enter 두 번">
        <ol className="text-xs text-subtle space-y-1 leading-relaxed">
          <li>① 입력창 위에서 <strong>마우스 우클릭</strong> (PowerShell 은 우클릭 = 붙여넣기)</li>
          <li>② <kbd className="kbd">Enter</kbd> 누르기 (한 번이면 보내져요)</li>
          <li>③ AI가 글자를 줄줄 흘리며 답해요. 30초~1분 기다리기</li>
          <li>④ 답이 다 끝나면 다시 <span className="text-emerald-700 font-mono">│</span> 입력창이 떠요</li>
        </ol>
      </Numbered>

      <Numbered n={4} title="코드만 골라서 복사하세요">
        <p className="text-xs text-subtle mb-2">
          AI 답변 중 <strong>```html ... ```</strong> 사이에 있는 게 코드예요.
        </p>
        <div className="rounded-xl bg-ink/95 text-white/90 p-3 font-mono text-[11px] leading-relaxed">
          <div className="text-white/60">코드 만들었어요:</div>
          <div className="mt-1 text-emerald-300">```html</div>
          <div className="text-white">&lt;!DOCTYPE html&gt;</div>
          <div className="text-white">&lt;html&gt;...</div>
          <div className="text-emerald-300">```</div>
        </div>
        <ol className="text-xs text-subtle space-y-1 mt-2 leading-relaxed">
          <li>① ```html 다음 줄부터 ``` 직전까지 마우스로 드래그</li>
          <li>② <kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">Shift</kbd>+<kbd className="kbd">C</kbd> (Windows 터미널) — 일반 Ctrl+C 는 멈춤 신호라 안 돼요</li>
          <li>③ 복사됐으면 다음 단계로</li>
        </ol>
      </Numbered>
    </div>
  );
}

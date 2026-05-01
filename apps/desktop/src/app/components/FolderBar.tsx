// 작업 폴더 정보 바 — 입문자가 "내 프로젝트가 컴퓨터 어디에 있는지" 항상 보이게.
// 3개 버튼: 📁 폴더 열기 / 💻 터미널 열기 (그 폴더에서) / 🤖 Claude Code 시작 (그 폴더에서).
// 브라우저 데모 모드에선 토스트로 "데스크톱 앱에서 진짜 동작" 안내.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ensureFolder,
  openFolderDirect,
  openTerminalIn,
  isTauri,
  parentFolder,
} from "@/lib/tauri";
import { globalTipQueue } from "@tg/tip-engine";
import { logTerminal } from "@/lib/terminalLog";

type ManualKind = "folder" | "terminal" | "claude";

interface Props {
  /** 파일 경로 또는 폴더 경로. 파일 경로면 자동으로 부모 추출. */
  pathOrFolder: string;
  /** 파일 경로면 true (부모 폴더가 작업 폴더), 폴더 경로면 false */
  isFilePath?: boolean;
  /** 화면에 한 줄 설명 — 컨텍스트 안내 */
  hint?: string;
}

export function FolderBar({ pathOrFolder, isFilePath = true, hint }: Props) {
  const folderPath = isFilePath ? parentFolder(pathOrFolder) : pathOrFolder;
  const [ensured, setEnsured] = useState<{
    actualPath: string;
    created: boolean;
  } | null>(null);
  const [manualKind, setManualKind] = useState<ManualKind | null>(null);

  // 마운트 시 폴더 보장. 입문자는 "여기 있구나" 만 알면 됨.
  useEffect(() => {
    let alive = true;
    void ensureFolder(folderPath).then((r) => {
      if (alive) setEnsured({ actualPath: r.path, created: r.created });
    });
    return () => {
      alive = false;
    };
  }, [folderPath]);

  const notify = (msg: string, pattern: "예고형" | "위로형" | "해석형" = "해석형") =>
    globalTipQueue.enqueue({
      id: `folderbar-${Date.now()}`,
      pattern,
      trigger: "상태",
      priority: 2,
      message: msg,
      ttlMs: 6000,
    });

  // 절대 경로 우선 — ~ 가 시스템 콜에서 안 풀려서 ensured.actualPath 사용.
  // ensured 안 도착하면 (~ 그대로) 버튼 disabled 로 race 방지.
  const absFolder = ensured?.actualPath ?? folderPath;
  const ready = !!ensured;

  const handleOpenFolder = async () => {
    if (!isTauri()) {
      setManualKind("folder");
      return;
    }
    const ok = await openFolderDirect(absFolder);
    if (!ok) {
      notify(
        "폴더 열기가 막혔어요. Rust 가 아직 새 명령을 모를 수 있어요 — 'pnpm tauri dev' 를 한 번 재시작해주세요.",
        "위로형",
      );
    }
  };

  const handleOpenTerminal = async () => {
    if (!isTauri()) {
      setManualKind("terminal");
      return;
    }
    const ok = await openTerminalIn(absFolder);
    if (!ok) {
      notify(
        "터미널 열기 실패 — Rust 새 명령 미등록일 수 있어요. 'pnpm tauri dev' 재시작 후 다시.",
        "위로형",
      );
    } else notify("✓ PowerShell 새 창이 열렸어요.");
  };

  const handleStartClaudeCode = async () => {
    if (!isTauri()) {
      setManualKind("claude");
      return;
    }
    const ok = await openTerminalIn(absFolder, "claude");
    if (!ok) {
      notify(
        "Claude Code 시작 실패 — 'claude' 명령이 PATH 에 있는지, Rust 가 새로 빌드됐는지 확인해주세요.",
        "위로형",
      );
    } else notify("✓ PowerShell 에서 Claude Code 시작 — 곧 입력창이 뜰 거예요.");
  };

  const displayPath = ensured?.actualPath ?? folderPath;

  return (
    <div className="rounded-xl bg-bg border border-subtle/15 p-3">
      <div className="flex items-start gap-2.5 mb-2">
        <span className="text-lg shrink-0" aria-hidden>
          📁
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-subtle">작업 폴더</p>
          <p className="text-xs font-mono text-ink truncate" title={displayPath}>
            {displayPath}
          </p>
          {hint && <p className="text-[10px] text-subtle mt-1">{hint}</p>}
          {ensured?.created && (
            <p className="text-[10px] text-success mt-1">✓ 방금 새로 만들었어요</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Btn
          icon="📂"
          label="폴더 열기"
          onClick={handleOpenFolder}
          hint="파일 탐색기에서"
          disabled={!ready}
        />
        <Btn
          icon="💻"
          label="터미널 열기"
          onClick={handleOpenTerminal}
          hint="이 폴더에서 PowerShell"
          disabled={!ready}
        />
        <Btn
          icon="🤖"
          label="Claude Code 시작"
          onClick={handleStartClaudeCode}
          hint="이 폴더에서 claude"
          disabled={!ready}
        />
      </div>

      <ManualGuideModal
        kind={manualKind}
        folderPath={displayPath}
        onClose={() => setManualKind(null)}
      />
    </div>
  );
}

function ManualGuideModal({
  kind,
  folderPath,
  onClose,
}: {
  kind: ManualKind | null;
  folderPath: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2000);
    });
  };

  if (!kind) return null;

  const titleByKind: Record<ManualKind, string> = {
    folder: "📂 폴더를 직접 열어볼게요",
    terminal: "💻 터미널을 직접 열어볼게요",
    claude: "🤖 Claude Code 를 직접 시작할게요",
  };

  const cdCommand = `cd "${folderPath}"`;
  const claudeCommand = `cd "${folderPath}"; claude`;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-lg rounded-2xl bg-surface border border-subtle/15 shadow-xl p-5"
          role="dialog"
        >
          <header className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-warning">
                브라우저 데모 — 자동 실행 불가
              </p>
              <h2 className="text-lg font-semibold text-ink">
                {titleByKind[kind]}
              </h2>
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

          <p className="text-xs text-subtle mb-4">
            크롬은 보안상 다른 앱을 못 켜요. 그래도 두 단계로 직접 할 수 있어요 — 제가 다 도와드릴게요.
          </p>

          {kind === "folder" && (
            <div className="space-y-3">
              <Step n={1} title="폴더 경로 복사">
                <CopyRow
                  text={folderPath}
                  copied={copied === "folder-path"}
                  onCopy={() => copy(folderPath, "folder-path")}
                />
              </Step>
              <Step n={2} title="Windows 키 + R 누르기">
                <p className="text-xs text-subtle">
                  '실행' 창이 떠요. <kbd className="kbd">Ctrl</kbd>+
                  <kbd className="kbd">V</kbd> 로 붙여넣고 Enter.
                </p>
              </Step>
              <Step n={3} title="파일 탐색기가 뜸">
                <p className="text-xs text-subtle">
                  ✓ 끝. 그 폴더에서 사진을 드래그하거나 파일을 만들 수 있어요.
                </p>
              </Step>
            </div>
          )}

          {kind === "terminal" && (
            <div className="space-y-3">
              <Step n={1} title="PowerShell 켜기">
                <p className="text-xs text-subtle">
                  Windows 검색에서 <strong>PowerShell</strong> 입력 → 켜기. 까만 창이 떠요.
                </p>
              </Step>
              <Step n={2} title="이 명령 복사·붙여넣기">
                <CopyRow
                  text={cdCommand}
                  copied={copied === "cd"}
                  onCopy={() => copy(cdCommand, "cd")}
                  monospace
                />
                <p className="text-[10px] text-subtle mt-1">
                  PowerShell 에서 <strong>마우스 우클릭</strong> = 붙여넣기. 그 다음 Enter.
                </p>
              </Step>
              <Step n={3} title="이제 그 폴더에서 명령 가능">
                <p className="text-xs text-subtle">
                  ✓ 끝. 이제 <code className="font-mono bg-bg px-1 rounded">dir</code> 로 파일 확인,{" "}
                  <code className="font-mono bg-bg px-1 rounded">claude</code> 로 AI 시작 등.
                </p>
              </Step>
            </div>
          )}

          {kind === "claude" && (
            <div className="space-y-3">
              <Step n={1} title="PowerShell 켜기">
                <p className="text-xs text-subtle">
                  Windows 검색에서 <strong>PowerShell</strong> → 까만 창이 떠요.
                </p>
              </Step>
              <Step n={2} title="이 두 줄 복사·붙여넣기">
                <CopyRow
                  text={claudeCommand}
                  copied={copied === "claude"}
                  onCopy={() => copy(claudeCommand, "claude")}
                  monospace
                />
                <p className="text-[10px] text-subtle mt-1">
                  ; 이 두 명령을 한 번에 실행시켜요. 첫 번째는 폴더 진입,{" "}
                  두 번째는 Claude Code 시작.
                </p>
              </Step>
              <Step n={3} title="Claude Code 입력창이 뜸">
                <p className="text-xs text-subtle">
                  ✓ 그 다음 부탁할 내용을 입력하면 됩니다.
                </p>
                <p className="text-[10px] text-warning mt-1">
                  ⚠️ <code className="font-mono bg-bg px-1 rounded">claude</code> 명령이 컴퓨터에 깔려야 동작해요.
                  안 깔렸으면 먼저 깔러 가야 합니다.
                </p>
              </Step>
            </div>
          )}

          <div className="mt-5 pt-3 border-t border-subtle/10 text-[11px] text-subtle">
            💡 <strong>데스크톱 앱</strong> (<code className="font-mono bg-bg px-1 rounded">pnpm tauri dev</code>) 을 띄우면 이 버튼 한 번으로 자동 실행돼요.
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink mb-1">{title}</p>
        {children}
      </div>
    </div>
  );
}

function CopyRow({
  text,
  copied,
  onCopy,
  monospace = false,
}: {
  text: string;
  copied: boolean;
  onCopy: () => void;
  monospace?: boolean;
}) {
  return (
    <div className="flex items-stretch gap-1.5">
      <code
        className={`flex-1 px-2.5 py-1.5 rounded-lg bg-bg border border-subtle/20 text-xs ${
          monospace ? "font-mono" : ""
        } text-ink truncate`}
        title={text}
      >
        {text}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
          copied
            ? "bg-success text-white"
            : "bg-primary text-white hover:opacity-90"
        }`}
      >
        {copied ? "✓ 복사됨" : "📋 복사"}
      </button>
    </div>
  );
}

function Btn({
  icon,
  label,
  hint,
  onClick,
  disabled = false,
}: {
  icon: string;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={disabled ? "폴더 준비 중..." : hint}
      disabled={disabled}
      className="flex-1 min-w-[110px] px-2.5 py-1.5 rounded-lg bg-surface border border-subtle/15 hover:border-primary/40 text-xs text-ink transition flex items-center gap-1.5 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span aria-hidden>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

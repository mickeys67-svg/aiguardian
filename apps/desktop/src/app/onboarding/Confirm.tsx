import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listRecipes, runRecipeStep, type StepRunResult } from "@/lib/tauri";
import { copyErrorToClipboard } from "@/lib/roundtripper";
import { ErrorPanel } from "@/app/ErrorPanel";
import { globalTipQueue } from "@tg/tip-engine";
import { useApp } from "../state";
import { AutoTerm } from "../components/AutoTerm";
import { TerminalCheatsheet } from "../components/TerminalCheatsheet";
import {
  shouldShowCheatsheet,
  markCheatsheetSeen,
  dismissCheatsheetForever,
} from "@/lib/cheatsheet";

type Mode = "idle" | "dry-running" | "dry-done" | "running" | "done";

export function Confirm() {
  const { data: recipes } = useQuery({
    queryKey: ["recipes"],
    queryFn: listRecipes,
  });
  const selectedId = useApp((s) => s.selectedRecipeId);
  const recipe = useMemo(
    () =>
      recipes?.find((r) => r.id === selectedId) ?? recipes?.[0] ?? null,
    [recipes, selectedId],
  );

  const [mode, setMode] = useState<Mode>("idle");
  const [results, setResults] = useState<StepRunResult[]>([]);
  const [errored, setErrored] = useState<StepRunResult | null>(null);
  // Confirm 첫 진입 시 단축키 치트시트 자동 노출. shared helper.
  const [cheatsheetOpen, setCheatsheetOpen] = useState(shouldShowCheatsheet);
  // 진짜 실행 직전 관리자 권한 안내 모달.
  const [adminWarningOpen, setAdminWarningOpen] = useState(false);
  const next = useApp((s) => s.next);

  // 명령어 중에 관리자 권한 / UAC 가 필요한 패턴 검출.
  const needsAdmin = useMemo(() => {
    if (!recipe) return false;
    return recipe.steps.some((s) => {
      const cmd = (s.command + " " + (s.windowsCommand ?? "")).toLowerCase();
      return /\b(npm install -g|sudo|elevate|runas|winget install|choco install|setx \/m|reg add hklm)\b/i.test(cmd);
    });
  }, [recipe]);

  useEffect(() => {
    // results.length === 0 이면 vacuously every() = true 라 빈 자동 next 방지.
    if (
      mode === "done" &&
      results.length > 0 &&
      results.every((r) => r.success && !r.blocked)
    ) {
      const t = window.setTimeout(() => next(), 800);
      return () => window.clearTimeout(t);
    }
  }, [mode, results, next]);

  if (!recipe) return null;

  const runSteps = async (dry: boolean) => {
    setMode(dry ? "dry-running" : "running");
    setResults([]);
    setErrored(null);
    const acc: StepRunResult[] = [];
    for (const step of recipe.steps) {
      if (!step.command) continue;
      const r = await runRecipeStep(
        step.id,
        step.command,
        step.windowsCommand ?? null,
        dry,
      );
      acc.push(r);
      setResults([...acc]);
      if (!r.success || r.blocked) {
        if (!dry) {
          // stderr 비어있어도 ErrorPanel 띄우기 — 입문자에게 일관성 있는 안내.
          setErrored({
            ...r,
            stderr: r.stderr || `'${step.title}' 단계가 실패했어요.`,
          });
        }
        break;
      }
    }
    setMode(dry ? "dry-done" : "done");
  };

  const handleAskAi = async () => {
    if (!errored) return;
    const failingStep = recipe.steps.find((s) => s.id === errored.stepId);
    const ok = await copyErrorToClipboard({
      command: failingStep?.command ?? errored.stepId,
      stdout: errored.stdout,
      stderr: errored.stderr,
      recipeId: recipe.id,
      stepId: errored.stepId,
    });
    globalTipQueue.enqueue({
      id: "ai-clipboard",
      pattern: ok ? "예고형" : "위로형",
      trigger: "상태",
      priority: 1,
      message: ok
        ? "에러를 AI에 보내기 좋게 복사했어요. Claude·Cursor에 붙여넣어 보세요."
        : "복사가 막혔어요. 아래 원본을 직접 복사해서 AI에 보내주세요.",
      ttlMs: 8000,
    });
  };

  if (errored) {
    return (
      <ErrorPanel
        rawError={errored.stderr}
        onAskAi={handleAskAi}
        onDismiss={() => {
          setErrored(null);
          setMode("idle");
          setResults([]);
        }}
      />
    );
  }

  const allSuccess =
    mode === "done" && results.length > 0 && results.every((r) => r.success && !r.blocked);
  const hasFailure =
    (mode === "done" || mode === "dry-done") &&
    results.some((r) => !r.success || r.blocked);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-2xl w-full px-6 py-10"
    >
      <header className="mb-6 text-center">
        <h2 className="text-2xl font-semibold text-ink mb-2">
          {allSuccess
            ? "준비물 챙겼어요!"
            : hasFailure
              ? "잠깐 멈췄어요"
              : mode === "dry-done"
                ? "안전 미리보기 완료"
                : "준비물부터 챙길게요"}
        </h2>
        <p className="text-subtle text-sm">
          {mode === "idle" && (
            <AutoTerm>안전을 위해 먼저 dry-run 으로 미리 확인해요.</AutoTerm>
          )}
          {mode === "dry-done" && !hasFailure &&
            "차단된 명령 없어요. 실제 실행해도 안전해요."}
          {mode === "dry-running" && "단계별 안전 확인 중..."}
          {mode === "running" && "실행 중이에요. 잠시만요..."}
          {allSuccess && "다음으로 AI에게 코드를 받아올게요."}
          {hasFailure &&
            "한 단계가 막혔어요. 아래 메시지를 보고 같이 풀어봐요."}
        </p>
      </header>

      {mode === "idle" && (
        <button
          type="button"
          onClick={() => runSteps(true)}
          className="w-full px-6 py-3 rounded-xl bg-primary text-white font-medium shadow-sm hover:opacity-90 transition"
        >
          dry-run 시작 (안전 미리보기)
        </button>
      )}

      {mode === "dry-done" && !hasFailure && (
        <button
          type="button"
          onClick={() => {
            if (needsAdmin) {
              setAdminWarningOpen(true);
            } else {
              runSteps(false);
            }
          }}
          className="w-full px-6 py-3 rounded-xl bg-primary text-white font-medium shadow-sm hover:opacity-90 transition"
        >
          ✓ 진짜 실행할게요
        </button>
      )}

      {/* 관리자 권한 사전 안내 모달 — UAC 갑작스러운 등장으로 인한 멘붕 차단. */}
      {adminWarningOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="bg-surface rounded-2xl border border-subtle/15 max-w-md w-full p-6 shadow-xl">
            <div className="text-3xl mb-3" aria-hidden>🛡</div>
            <h3 className="text-lg font-bold text-ink mb-2">
              잠깐, 관리자 권한이 필요해요
            </h3>
            <p className="text-sm text-ink mb-3">
              이 작업은 시스템에 도구를 깔아드려요. Windows 가 잠깐 <strong>UAC</strong> 라는 창을 띄울 거예요:
            </p>
            <div className="bg-bg border border-subtle/20 rounded-xl p-3 mb-3 text-xs text-subtle font-mono">
              "이 앱이 디바이스를 변경할 수 있도록 허용하시겠어요?"
            </div>
            <p className="text-xs text-subtle mb-5 leading-relaxed">
              걱정하지 마세요 — Vibemate 가 안전 검사한 명령만 실행해요. <strong>예</strong> 를 누르시면 됩니다.
              <br />
              ⚠ 만약 백신 (V3, 알약 등) 이 차단하면 일시 중지 후 재시도하세요.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdminWarningOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-surface border border-subtle/20 text-sm text-subtle hover:text-ink"
              >
                나중에
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminWarningOpen(false);
                  runSteps(false);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90"
              >
                알겠어요, 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {(mode === "dry-running" || mode === "running") && (
        <p className="text-center text-sm text-subtle">
          {mode === "dry-running"
            ? "단계별 안전 확인 중..."
            : "실제 실행 중..."}
        </p>
      )}

      {allSuccess && (
        <p className="text-center text-sm text-subtle">
          다음 단계로 자동 이동해요...
        </p>
      )}

      {hasFailure && (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              setMode("idle");
              setResults([]);
            }}
            className="w-full px-6 py-2.5 rounded-xl bg-surface border border-subtle/20 text-sm hover:border-primary/40 transition"
          >
            🔄 다시 시도
          </button>
        </div>
      )}

      {results.length > 0 && (
        <ol className="space-y-3 mt-6">
          {results.map((r) => (
            <li
              key={r.stepId}
              className={`rounded-xl p-4 border text-sm ${
                r.blocked
                  ? "border-error/40 bg-error/5"
                  : r.success
                    ? "border-success/30 bg-success/5"
                    : "border-warning/40 bg-warning/5"
              }`}
            >
              <p className="font-medium text-ink">
                {r.blocked ? "🛑" : r.success ? "✅" : "⚠️"} {r.stepId}
              </p>
              {r.stdout && (
                <pre className="mt-1 text-[11px] font-mono text-ink/80 whitespace-pre-wrap max-h-32 overflow-auto">
                  {r.stdout}
                </pre>
              )}
              {r.stderr && (
                <pre className="mt-1 text-[11px] font-mono text-error/90 whitespace-pre-wrap max-h-32 overflow-auto">
                  {r.stderr}
                </pre>
              )}
            </li>
          ))}
        </ol>
      )}

      <TerminalCheatsheet
        open={cheatsheetOpen}
        onClose={() => {
          markCheatsheetSeen();
          setCheatsheetOpen(false);
        }}
        onNeverAgain={() => {
          dismissCheatsheetForever();
          setCheatsheetOpen(false);
        }}
      />
    </motion.section>
  );
}

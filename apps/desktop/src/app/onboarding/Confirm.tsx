import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { useQuery } from "@tanstack/react-query";
import { listRecipes, runRecipeStep, type StepRunResult } from "@/lib/tauri";

export function Confirm() {
  const { data: recipes } = useQuery({
    queryKey: ["recipes"],
    queryFn: listRecipes,
  });
  const recipe = recipes?.[0];

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<StepRunResult[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) {
      void confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [done]);

  if (!recipe) return null;

  const runAll = async () => {
    setRunning(true);
    setResults([]);
    const acc: StepRunResult[] = [];
    for (const step of recipe.steps) {
      if (!step.command) continue;
      const r = await runRecipeStep(step.id, step.command, true /* dry */);
      acc.push(r);
      setResults([...acc]);
      if (!r.success || r.blocked) break;
    }
    setRunning(false);
    setDone(acc.every((r) => r.success && !r.blocked));
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-2xl w-full px-6 py-10"
    >
      <header className="mb-6 text-center">
        <h2 className="text-2xl font-semibold text-ink mb-2">
          {done ? "축하해요! 🎉" : "이제 함께 만들어볼게요"}
        </h2>
        <p className="text-subtle text-sm">
          {done
            ? "v0.1 데모는 dry-run 모드예요. 실제 실행은 Week 4 후반에 활성화돼요."
            : "안전을 위해 먼저 dry-run으로 미리 확인해요."}
        </p>
      </header>

      {!running && results.length === 0 && (
        <button
          type="button"
          onClick={runAll}
          className="w-full px-6 py-3 rounded-xl bg-primary text-white font-medium shadow-sm hover:opacity-90 transition"
        >
          dry-run 시작 (안전 미리보기)
        </button>
      )}

      {running && (
        <p className="text-center text-sm text-subtle">
          단계별로 안전 확인 중이에요...
        </p>
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
                <pre className="mt-1 text-[11px] font-mono text-ink/80 whitespace-pre-wrap">
                  {r.stdout}
                </pre>
              )}
              {r.stderr && (
                <pre className="mt-1 text-[11px] font-mono text-error/90 whitespace-pre-wrap">
                  {r.stderr}
                </pre>
              )}
            </li>
          ))}
        </ol>
      )}
    </motion.section>
  );
}

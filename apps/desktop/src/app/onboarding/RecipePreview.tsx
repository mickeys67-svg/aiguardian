import { motion } from "framer-motion";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listRecipes } from "@/lib/tauri";
import { useOnboarding } from "../state";
import { AutoTerm } from "../components/AutoTerm";

export function RecipePreview() {
  const { data: recipes } = useQuery({
    queryKey: ["recipes"],
    queryFn: listRecipes,
  });
  const next = useOnboarding((s) => s.next);
  const setStage = useOnboarding((s) => s.setStage);
  const selectedId = useOnboarding((s) => s.selectedRecipeId);

  const recipe = useMemo(
    () =>
      recipes?.find((r) => r.id === selectedId) ?? recipes?.[0] ?? null,
    [recipes, selectedId],
  );

  if (!recipe) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl w-full px-6 py-10"
    >
      <button
        type="button"
        onClick={() => setStage("goal")}
        className="text-xs text-subtle hover:text-ink mb-3 flex items-center gap-1"
      >
        ← 다른 거 고를래요
      </button>

      <header className="mb-6">
        <p className="text-xs text-subtle mb-1">
          {recipe.difficulty} · {recipe.estMinutes}분 예상
        </p>
        <h2 className="text-2xl font-semibold text-ink mb-2">{recipe.title}</h2>
        <p className="text-subtle text-sm">{recipe.description}</p>
      </header>

      <div className="rounded-2xl bg-surface border border-subtle/15 p-5 mb-6">
        <h3 className="font-semibold text-ink text-sm mb-3">이렇게 진행돼요</h3>
        <ol className="space-y-3">
          {recipe.steps.map((s, i) => (
            <li key={s.id} className="text-sm">
              <p className="font-medium text-ink">
                {i + 1}. {s.title}
              </p>
              <p className="text-subtle text-xs mt-0.5">
                <AutoTerm>{s.description}</AutoTerm>
              </p>
              {s.command && (
                <code className="block mt-1.5 text-[11px] font-mono bg-bg rounded px-2 py-1 text-ink/80">
                  {s.command}
                </code>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 text-sm text-ink mb-3">
        <p className="font-medium mb-1">완성하면?</p>
        <p className="text-subtle text-xs">{recipe.outcome}</p>
      </div>

      <div className="rounded-2xl bg-surface border border-subtle/15 p-3 text-xs mb-3 flex items-center gap-2">
        <span aria-hidden>📁</span>
        <span className="text-subtle">새 폴더 위치:</span>
        <code className="font-mono text-ink truncate">
          ~/projects/{recipe.id}
        </code>
        <span className="text-[10px] text-subtle ml-auto">
          시작하면 자동 생성
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-subtle mb-6">
        <span>⏱ 약 {recipe.estMinutes}분</span>
        <span>•</span>
        <span>💰 무료</span>
        <span>•</span>
        <span>🔄 폴더 하나 지우면 끝까지 되돌리기</span>
      </div>

      <button
        type="button"
        onClick={next}
        className="w-full px-6 py-3 rounded-xl bg-primary text-white font-medium shadow-sm hover:opacity-90 transition"
      >
        ✓ 시작
      </button>
    </motion.section>
  );
}

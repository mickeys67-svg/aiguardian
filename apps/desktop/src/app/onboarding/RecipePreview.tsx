import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { listRecipes } from "@/lib/tauri";
import { useOnboarding } from "../state";

export function RecipePreview() {
  const { data: recipes } = useQuery({
    queryKey: ["recipes"],
    queryFn: listRecipes,
  });
  const next = useOnboarding((s) => s.next);

  const recipe = recipes?.[0];
  if (!recipe) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl w-full px-6 py-10"
    >
      <header className="mb-6">
        <p className="text-xs text-subtle mb-1">
          {recipe.difficulty} · {recipe.estMinutes}분 예상
        </p>
        <h2 className="text-2xl font-semibold text-ink mb-2">{recipe.title}</h2>
        <p className="text-subtle text-sm">{recipe.description}</p>
      </header>

      <div className="rounded-2xl bg-surface border border-subtle/15 p-5 mb-6">
        <h3 className="font-semibold text-ink text-sm mb-3">단계 미리보기</h3>
        <ol className="space-y-3">
          {recipe.steps.map((s, i) => (
            <li key={s.id} className="text-sm">
              <p className="font-medium text-ink">
                {i + 1}. {s.title}
              </p>
              <p className="text-subtle text-xs mt-0.5">{s.description}</p>
              {s.command && (
                <code className="block mt-1.5 text-[11px] font-mono bg-bg rounded px-2 py-1 text-ink/80">
                  {s.command}
                </code>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 text-sm text-ink mb-6">
        <p className="font-medium mb-1">완성하면?</p>
        <p className="text-subtle text-xs">{recipe.outcome}</p>
      </div>

      <button
        type="button"
        onClick={next}
        className="w-full px-6 py-3 rounded-xl bg-primary text-white font-medium shadow-sm hover:opacity-90 transition"
      >
        준비됐어요. 시작할게요
      </button>
    </motion.section>
  );
}

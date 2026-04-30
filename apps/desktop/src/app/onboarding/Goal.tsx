import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { listRecipes, type Recipe } from "@/lib/tauri";
import { useOnboarding } from "../state";

export function Goal() {
  const { data: recipes } = useQuery({
    queryKey: ["recipes"],
    queryFn: listRecipes,
  });
  const next = useOnboarding((s) => s.next);

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl w-full px-6 py-10"
    >
      <header className="mb-6 text-center">
        <h2 className="text-2xl font-semibold text-ink mb-2">
          오늘 뭐 만들어볼까요?
        </h2>
        <p className="text-subtle text-sm">
          처음이면 ⭐ 표시된 거 추천해요. 5~30분이면 끝나요.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(recipes ?? []).map((r) => (
          <RecipeCard key={r.id} recipe={r} onSelect={() => next()} />
        ))}
      </div>

      {(!recipes || recipes.length === 0) && (
        <p className="text-subtle text-sm text-center mt-8">
          레시피를 불러오는 중이에요...
        </p>
      )}
    </motion.section>
  );
}

function RecipeCard({
  recipe,
  onSelect,
}: {
  recipe: Recipe;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="text-left rounded-2xl bg-surface border border-subtle/15 p-5 hover:border-primary/40 hover:shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-ink">
          {recipe.featured && <span aria-hidden>⭐ </span>}
          {recipe.title}
        </h3>
        <span className="text-[11px] text-subtle whitespace-nowrap">
          {recipe.estMinutes}분 · {recipe.difficulty}
        </span>
      </div>
      <p className="text-xs text-subtle mb-2">{recipe.description}</p>
      <p className="text-xs text-primary">→ {recipe.outcome}</p>
    </button>
  );
}

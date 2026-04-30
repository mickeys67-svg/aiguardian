import { useQuery } from "@tanstack/react-query";
import { listRecipes } from "@/lib/tauri";

export function RecipesSection() {
  const { data: recipes } = useQuery({
    queryKey: ["recipes"],
    queryFn: listRecipes,
  });

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink mb-1">레시피</h1>
        <p className="text-sm text-subtle">
          {recipes?.length ?? 0}개의 시작 템플릿. 더 많은 레시피는 v1.0 부터.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(recipes ?? []).map((r) => (
          <article
            key={r.id}
            className="rounded-2xl bg-surface border border-subtle/15 p-4"
          >
            <p className="text-xs text-subtle mb-1">
              {r.featured ? "⭐ " : ""}
              {r.estMinutes}분 · {r.difficulty}
            </p>
            <h3 className="font-semibold text-ink mb-1">{r.title}</h3>
            <p className="text-xs text-subtle mb-2">{r.description}</p>
            <p className="text-xs text-primary">→ {r.outcome}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

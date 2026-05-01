import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listRecipes, type Recipe } from "@/lib/tauri";
import { useApp } from "../state";
import { ConfirmModal } from "../components/ConfirmModal";

export function RecipesSection() {
  const { data: recipes, isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: listRecipes,
  });
  const enterRecipeFlow = useApp((s) => s.enterRecipeFlow);
  const [pending, setPending] = useState<Recipe | null>(null);

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink mb-1">레시피</h1>
        <p className="text-sm text-subtle">
          {recipes?.length ?? 0}개의 시작 템플릿. 마음에 드는 걸 누르면 바로 만들 수 있어요.
        </p>
      </header>

      {isLoading && (
        <p className="text-subtle text-sm">레시피를 불러오는 중...</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(recipes ?? []).map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setPending(r)}
            className="text-left rounded-2xl bg-surface border border-subtle/15 p-4 hover:border-primary/40 hover:shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <p className="text-xs text-subtle mb-1">
              {r.featured ? "⭐ " : ""}
              {r.estMinutes}분 · {r.difficulty}
            </p>
            <h3 className="font-semibold text-ink mb-1">{r.title}</h3>
            <p className="text-xs text-subtle mb-2 line-clamp-2">{r.description}</p>
            <p className="text-xs text-primary">→ {r.outcome}</p>
          </button>
        ))}
      </div>

      <ConfirmModal
        open={!!pending}
        title={pending ? `${pending.title} 시작할까요?` : ""}
        message={
          pending
            ? `약 ${pending.estMinutes}분 걸려요. 단계마다 안전 미리보기를 거칩니다.`
            : ""
        }
        safeNote="결과물 폴더 하나만 만들어요. 다른 곳은 안 건드립니다."
        confirmLabel="시작"
        onConfirm={() => {
          if (pending) {
            enterRecipeFlow(pending.id);
          }
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

import { useState } from "react";
import { useEnvironment } from "@/lib/hooks";
import { useQuery } from "@tanstack/react-query";
import { listRecipes } from "@/lib/tauri";
import { useApp } from "../state";
import { useProjects, type ProjectRecord } from "@/lib/projects";
import { ConfirmModal } from "../components/ConfirmModal";
import { ProjectCard, type ProjectCardAction } from "../components/ProjectCard";

export function Home() {
  const { data: env } = useEnvironment();
  const { data: recipes } = useQuery({
    queryKey: ["recipes"],
    queryFn: listRecipes,
  });
  const setSection = useApp((s) => s.setSection);
  const enterRecipeFlow = useApp((s) => s.enterRecipeFlow);
  const projects = useProjects();
  const [pendingRecipeId, setPendingRecipeId] = useState<string | null>(null);

  const ready =
    (env?.runtimes.filter((t) => t.installed).length ?? 0) +
    (env?.packageManagers.filter((t) => t.installed).length ?? 0);
  const total =
    (env?.runtimes.length ?? 0) + (env?.packageManagers.length ?? 0);

  const pendingRecipe = recipes?.find((r) => r.id === pendingRecipeId);

  const handleAction = (action: ProjectCardAction, p: ProjectRecord) => {
    if (action === "remake") {
      setPendingRecipeId(p.recipeId);
      return;
    }
    // open/edit/detail/folder — 자세히 화면(Projects 섹션)으로 보냄.
    setSection("projects");
  };

  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-ink mb-1">
          안녕하세요. 오늘 뭐 만들어볼까요?
        </h1>
        <p className="text-sm text-subtle">
          {env
            ? `환경 ${ready}/${total} 준비됨${env.cached ? " · 캐시" : ""}`
            : "환경 확인 중..."}
        </p>
      </header>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink text-sm">최근에 만든 거</h2>
          {projects.length > 0 && (
            <button
              type="button"
              onClick={() => setSection("projects")}
              className="text-xs text-primary hover:underline"
            >
              모두 보기
            </button>
          )}
        </div>
        {projects.length === 0 ? (
          <div className="rounded-2xl bg-surface border border-subtle/15 p-5 text-sm text-subtle">
            아직 만든 게 없어요. 아래 추천 레시피로 첫 작품을 만들어볼까요?
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.slice(0, 4).map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                actions={["open", "edit", "remake"]}
                onAction={handleAction}
                compact
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink text-sm">이런 거 어때요?</h2>
          <button
            type="button"
            onClick={() => setSection("recipes")}
            className="text-xs text-primary hover:underline"
          >
            전체 갤러리
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(recipes ?? []).slice(0, 3).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setPendingRecipeId(r.id)}
              className="text-left rounded-2xl bg-surface border border-subtle/15 p-4 hover:border-primary/40 transition"
            >
              <p className="text-xs text-subtle mb-1">
                {r.featured ? "⭐ " : ""}
                {r.estMinutes}분 · {r.difficulty}
              </p>
              <p className="font-semibold text-ink text-sm mb-1">{r.title}</p>
              <p className="text-xs text-subtle line-clamp-2">{r.description}</p>
            </button>
          ))}
        </div>
      </section>

      <ConfirmModal
        open={!!pendingRecipe}
        title={pendingRecipe ? `${pendingRecipe.title} 시작할까요?` : ""}
        message={
          pendingRecipe
            ? `약 ${pendingRecipe.estMinutes}분 걸려요. 단계마다 안전 미리보기를 거칩니다.`
            : ""
        }
        safeNote="결과물 폴더 하나만 만들어요. 다른 곳은 안 건드립니다."
        confirmLabel="시작"
        onConfirm={() => {
          if (pendingRecipe) enterRecipeFlow(pendingRecipe.id);
          setPendingRecipeId(null);
        }}
        onCancel={() => setPendingRecipeId(null)}
      />

    </div>
  );
}

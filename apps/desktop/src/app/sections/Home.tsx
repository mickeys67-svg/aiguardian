import { useEnvironment } from "@/lib/hooks";
import { useQuery } from "@tanstack/react-query";
import { listRecipes } from "@/lib/tauri";
import { useApp } from "../state";

export function Home() {
  const { data: env } = useEnvironment();
  const { data: recipes } = useQuery({
    queryKey: ["recipes"],
    queryFn: listRecipes,
  });
  const setSection = useApp((s) => s.setSection);
  const selectRecipe = useApp((s) => s.selectRecipe);

  const ready =
    (env?.runtimes.filter((t) => t.installed).length ?? 0) +
    (env?.packageManagers.filter((t) => t.installed).length ?? 0);
  const total =
    (env?.runtimes.length ?? 0) + (env?.packageManagers.length ?? 0);

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

      <section className="mb-8 rounded-2xl bg-surface border border-subtle/15 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink text-sm">진행 중 프로젝트</h2>
          <button
            type="button"
            onClick={() => setSection("projects")}
            className="text-xs text-primary hover:underline"
          >
            모두 보기
          </button>
        </div>
        <p className="text-sm text-subtle">
          아직 시작한 프로젝트가 없어요. 아래 추천 레시피로 시작해보세요.
        </p>
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
              onClick={() => {
                selectRecipe(r.id);
                setSection("recipes");
              }}
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
    </div>
  );
}

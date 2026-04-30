import { useQuery } from "@tanstack/react-query";
import { learningProgress } from "@/lib/tauri";

export function Learn() {
  const { data } = useQuery({
    queryKey: ["learning-progress"],
    queryFn: learningProgress,
  });

  const total = data?.total ?? 0;
  const mastered = data?.mastered ?? 0;
  const ratio = total > 0 ? Math.round((mastered / total) * 100) : 0;

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink mb-1">학습</h1>
        <p className="text-sm text-subtle">
          본 명령어·도구·개념이 여기 쌓여요. 80%에 도달하면 졸업 배지.
        </p>
      </header>

      <section className="rounded-2xl bg-surface border border-subtle/15 p-6 mb-4">
        <p className="text-xs text-subtle mb-2">졸업 진행도</p>
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-3xl font-bold text-ink">{ratio}%</span>
          <span className="text-xs text-subtle">
            {mastered} / {total} 익힘
          </span>
        </div>
        <div className="h-2 w-full bg-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${ratio}%` }}
          />
        </div>
      </section>

      <p className="text-xs text-subtle text-center">
        학습 카드 v2 (간격 반복) 는 v2.0 마일스톤에서 도착해요.
      </p>
    </div>
  );
}

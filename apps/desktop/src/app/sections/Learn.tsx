import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { learningProgress } from "@/lib/tauri";
import { GLOSSARY } from "@/lib/glossary";
import { useGuidance } from "@/lib/guidance";
import { useProjects } from "@/lib/projects";
import { InfoPanel } from "../components/InfoPanel";

export function Learn() {
  const { data } = useQuery({
    queryKey: ["learning-progress"],
    queryFn: learningProgress,
  });
  const runs = useGuidance((s) => s.experience.runs);
  const projects = useProjects();
  const [openTerm, setOpenTerm] = useState<string | null>(null);

  // 졸업 진행도: 만든 작품 수 + 학습한 용어 수 가중 평균.
  const total = data?.total ?? 0;
  const mastered = data?.mastered ?? 0;
  const termRatio = total > 0 ? mastered / total : 0;
  const projectRatio = Math.min(projects.length / 5, 1);
  const overall = Math.round((termRatio * 0.5 + projectRatio * 0.5) * 100);

  const allTerms = Object.keys(GLOSSARY).sort();

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink mb-1">배우기</h1>
        <p className="text-sm text-subtle">
          작품을 만들수록·용어를 만날수록 자연스럽게 배워요.
        </p>
      </header>

      {/* 졸업 진행도 */}
      <section className="rounded-2xl bg-surface border border-subtle/15 p-5 mb-5">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs text-subtle">전체 진행</p>
          <span className="text-3xl font-bold text-ink">{overall}%</span>
        </div>
        <div className="h-2 w-full bg-bg rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${overall}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-bg p-3">
            <p className="text-subtle mb-1">만든 작품</p>
            <p className="text-lg font-bold text-ink">
              {projects.length} <span className="text-xs text-subtle font-normal">/ 5</span>
            </p>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <p className="text-subtle mb-1">완수한 사이클</p>
            <p className="text-lg font-bold text-ink">{runs}</p>
          </div>
        </div>
      </section>

      {/* 용어 사전 */}
      <section className="mb-5">
        <h2 className="text-sm font-semibold text-ink mb-3">
          용어 사전 ({allTerms.length}개)
        </h2>
        <p className="text-xs text-subtle mb-3">
          앱에서 단어 위에 마우스를 올리면 풀이가 떠요. 여기서 한 번에 볼 수도
          있어요. 카드를 누르면 자세히.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {allTerms.map((term) => {
            const entry = GLOSSARY[term]!;
            return (
              <button
                key={term}
                type="button"
                onClick={() => setOpenTerm(term)}
                className="text-left rounded-xl bg-surface border border-subtle/15 p-3 hover:border-primary/40 transition"
              >
                <p className="font-semibold text-ink text-sm mb-1">{term}</p>
                <p className="text-xs text-subtle line-clamp-2">{entry.short}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 다음 도전 */}
      <section className="rounded-2xl bg-primary/5 border border-primary/20 p-4">
        <h2 className="text-sm font-semibold text-ink mb-2">
          🎯 다음 도전
        </h2>
        {projects.length === 0 ? (
          <p className="text-xs text-subtle">
            첫 작품을 만들면 여기에 다음 추천이 떠요.
          </p>
        ) : projects.length < 3 ? (
          <p className="text-xs text-subtle">
            벌써 {projects.length}개 만들었어요. 3개까지 만들면 "초보 졸업" 뱃지를
            얻어요. 레시피 갤러리에서 새 도전 골라보세요.
          </p>
        ) : (
          <p className="text-xs text-subtle">
            🎉 3개 이상 완수! 이제 "수정하기" 로 깊이 다듬어보세요. 이터레이션
            10번 = "장인" 단계.
          </p>
        )}
      </section>

      <InfoPanel term={openTerm} onClose={() => setOpenTerm(null)} />
    </div>
  );
}

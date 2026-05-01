import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listRecipes, type Recipe } from "@/lib/tauri";
import { useEnvironment } from "@/lib/hooks";
import { useOnboarding } from "../state";
import { Coachmark } from "../components/Coachmark";
import { AutoTerm } from "../components/AutoTerm";

type Tab = "starter" | "advanced";

export function Goal() {
  const { data: recipes, isLoading, isError, refetch } = useQuery({
    queryKey: ["recipes"],
    queryFn: listRecipes,
  });
  const next = useOnboarding((s) => s.next);
  const selectRecipe = useOnboarding((s) => s.selectRecipe);
  const startRun = useOnboarding((s) => s.startRun);
  const [tab, setTab] = useState<Tab>("starter");
  const [hovered, setHovered] = useState<string | null>(null);
  // Diagnosis 를 Skip 했다면 환경 데이터가 없음 — 안내 배너.
  const { data: env, isError: envError } = useEnvironment();
  const skippedDiagnosis = !env && !envError;

  const list = (recipes ?? []).filter((r) =>
    tab === "starter" ? r.featured : !r.featured,
  );

  const handlePick = (r: Recipe) => {
    selectRecipe(r.id);
    startRun(r.id);
    next();
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl w-full px-6 py-10"
    >
      <Coachmark
        id="goal-pick-star"
        screenId="goal"
        title="처음이시면 ⭐ 추천이에요"
        body="여기 카드 중 하나를 눌러 시작하세요. 만들어보고 다른 걸 또 해도 돼요."
      />

      <header className="mb-6 text-center">
        <h2 className="text-2xl font-semibold text-ink mb-2">
          오늘 뭐 만들어볼까요?
        </h2>
        <p className="text-subtle text-sm">
          처음이면 ⭐ 표시된 거 추천해요. 5~30분이면 끝나요.
        </p>
      </header>

      {skippedDiagnosis && (
        <div className="mb-5 rounded-xl bg-warning/10 border border-warning/30 p-3 text-xs text-ink">
          <p className="font-medium mb-1">
            ⚠️ 환경 진단을 건너뛰었어요
          </p>
          <p className="text-subtle leading-relaxed">
            도구 (Node·Git·Python 등) 가 깔려있는지 모르는 상태예요. 막히면
            우상단 "?" → "이 화면 다시 안내" 또는 ⚙️ 설정 → 환경 다시 진단을
            누를 수 있어요.
          </p>
        </div>
      )}

      <div className="flex justify-center gap-1 mb-6" role="tablist">
        <TabBtn active={tab === "starter"} onClick={() => setTab("starter")}>
          ⭐ 입문
        </TabBtn>
        <TabBtn active={tab === "advanced"} onClick={() => setTab("advanced")}>
          🔥 도전
        </TabBtn>
      </div>

      {isLoading && (
        <p className="text-subtle text-sm text-center mt-8">
          레시피를 불러오는 중이에요...
        </p>
      )}

      {isError && (
        <div className="rounded-2xl bg-warning/10 border border-warning/30 p-5 text-center">
          <p className="text-sm text-ink mb-3">
            레시피 목록을 불러오지 못했어요.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium"
          >
            다시 시도
          </button>
        </div>
      )}

      {!isLoading && !isError && list.length === 0 && (
        <p className="text-subtle text-sm text-center mt-8">
          {tab === "starter"
            ? "입문 레시피가 없어요. 도전 탭을 봐주세요."
            : "도전 레시피가 없어요. 입문 탭으로 시작하세요."}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {list.map((r) => (
          <RecipeCard
            key={r.id}
            recipe={r}
            onSelect={() => handlePick(r)}
            onHover={(h) => setHovered(h ? r.id : null)}
            isHovered={hovered === r.id}
          />
        ))}
      </div>
    </motion.section>
  );
}

function TabBtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm transition ${
        active
          ? "bg-primary text-white"
          : "bg-surface border border-subtle/15 text-subtle hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function RecipeCard({
  recipe,
  onSelect,
  onHover,
  isHovered,
}: {
  recipe: Recipe;
  onSelect: () => void;
  onHover: (h: boolean) => void;
  isHovered: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`text-left rounded-2xl bg-surface border p-5 transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${
        isHovered
          ? "border-primary/50 shadow-md -translate-y-0.5"
          : "border-subtle/15 hover:border-primary/40"
      }`}
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
      <p className="text-xs text-subtle mb-2">
        <AutoTerm>{recipe.description}</AutoTerm>
      </p>
      <p className="text-xs text-primary">
        → <AutoTerm>{recipe.outcome}</AutoTerm>
      </p>
    </button>
  );
}

import { useEffect } from "react";
import { globalTipQueue, type TipPattern } from "@tg/tip-engine";
import { Welcome } from "./app/onboarding/Welcome";
import { Diagnosis } from "./app/onboarding/Diagnosis";
import { Result } from "./app/onboarding/Result";
import { Goal } from "./app/onboarding/Goal";
import { RecipePreview } from "./app/onboarding/RecipePreview";
import { Confirm } from "./app/onboarding/Confirm";
import { TipToast } from "./app/TipToast";
import { useOnboarding } from "./app/state";

export default function App() {
  const stage = useOnboarding((s) => s.stage);

  // v0.9 §2.2 단계 진입 시 시점 트리거 팁 1개씩 푸시.
  useEffect(() => {
    const map: Record<typeof stage, { pattern: TipPattern; message: string } | null> = {
      welcome: null,
      diagnosis: {
        pattern: "예고형",
        message: "당신 컴퓨터에 뭐가 깔렸는지만 봐요. 파일 내용은 절대 안 봐요.",
      },
      result: {
        pattern: "해석형",
        message: "✅ 는 준비됨, ⚠️ 는 제가 깔아드릴 거예요.",
      },
      goal: {
        pattern: "예고형",
        message: "처음이면 ⭐ 추천 가요. 5~30분이면 끝나요.",
      },
      recipe: {
        pattern: "교육형",
        message: "각 단계는 작은 명령 하나예요. 한 줄씩 보여드릴게요.",
      },
      confirm: {
        pattern: "검증형",
        message: "안전을 위해 먼저 dry-run으로 미리 확인해요.",
      },
    };
    const tip = map[stage];
    if (tip) {
      globalTipQueue.enqueue({
        id: `stage-${stage}`,
        pattern: tip.pattern,
        trigger: "시점",
        priority: 3,
        message: tip.message,
        ttlMs: 6000,
      });
    }
  }, [stage]);

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-bg">
      {stage === "welcome" && <Welcome />}
      {stage === "diagnosis" && <Diagnosis />}
      {stage === "result" && <Result />}
      {stage === "goal" && <Goal />}
      {stage === "recipe" && <RecipePreview />}
      {stage === "confirm" && <Confirm />}
      <TipToast />
    </main>
  );
}

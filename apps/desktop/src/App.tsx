import { useEffect, useState } from "react";
import { globalTipQueue, type TipPattern } from "@tg/tip-engine";
import { track } from "./lib/telemetry";
import { Welcome } from "./app/onboarding/Welcome";
import { Diagnosis } from "./app/onboarding/Diagnosis";
import { Result } from "./app/onboarding/Result";
import { Goal } from "./app/onboarding/Goal";
import { RecipePreview } from "./app/onboarding/RecipePreview";
import { Confirm } from "./app/onboarding/Confirm";
import { AiBridge } from "./app/onboarding/AiBridge";
import { Artifact } from "./app/onboarding/Artifact";
import { TipToast } from "./app/TipToast";
import { Shell } from "./app/shell/Shell";
import { CaptureFloater } from "./app/CaptureFloater";
import { AiChat } from "./app/AiChat";
import { HelpButton } from "./app/components/HelpButton";
import { DemoBanner } from "./app/components/DemoBanner";
import { useApp, type OnboardingStage } from "./app/state";

export default function App() {
  const mode = useApp((s) => s.mode);
  const stage = useApp((s) => s.stage);
  const section = useApp((s) => s.section);
  const selectedRecipeId = useApp((s) => s.selectedRecipeId);

  const [chatOpen, setChatOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (mode !== "onboarding") return;
    const map: Record<OnboardingStage, { pattern: TipPattern; message: string } | null> = {
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
      aibridge: {
        pattern: "예고형",
        message:
          "이제 AI한테 코드를 받아올게요. 3단계로 천천히 — 못 하면 🤖 버튼 눌러요.",
      },
      artifact: {
        pattern: "축하형",
        message: "축하해요! 첫 결과물이에요. 브라우저에서 직접 봐보세요.",
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
    track("tg.stage.entered", { stage });
  }, [mode, stage]);

  const screenId =
    mode === "onboarding" ? `onboarding:${stage}` : `main:${section}`;

  const handleCapture = (dataUrl: string) => {
    setPendingImage(dataUrl);
    setChatOpen(true);
  };

  const ctx = {
    screen: screenId,
    recipeId: selectedRecipeId ?? undefined,
  };

  if (mode === "main") {
    return (
      <>
        <DemoBanner />
        <Shell />
        <TipToast />
        <HelpButton
          screenId={screenId}
          onOpenChat={() => setChatOpen(true)}
        />
        <CaptureFloater
          context={ctx}
          onCapture={handleCapture}
          onOpenChat={() => setChatOpen(true)}
        />
        <AiChat
          open={chatOpen}
          onClose={() => {
            setChatOpen(false);
            setPendingImage(undefined);
          }}
          pendingImage={pendingImage}
          context={ctx}
        />
      </>
    );
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-bg">
      <DemoBanner />
      {stage === "welcome" && <Welcome />}
      {stage === "diagnosis" && <Diagnosis />}
      {stage === "result" && <Result />}
      {stage === "goal" && <Goal />}
      {stage === "recipe" && <RecipePreview />}
      {stage === "confirm" && <Confirm />}
      {stage === "aibridge" && <AiBridge />}
      {stage === "artifact" && <Artifact />}
      <TipToast />
      <HelpButton screenId={screenId} onOpenChat={() => setChatOpen(true)} />
      <CaptureFloater
        context={ctx}
        onCapture={handleCapture}
        onOpenChat={() => setChatOpen(true)}
      />
      <AiChat
        open={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setPendingImage(undefined);
        }}
        pendingImage={pendingImage}
        context={ctx}
      />
    </main>
  );
}

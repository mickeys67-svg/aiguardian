// [8] 결과 확인 — 입문자가 자기가 만든 결과물을 보는 첫 모먼트.
// 컨페티는 여기서. 브라우저 자동 오픈 + 폴더 열기 + 다음 사이클 유도.

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { useQuery } from "@tanstack/react-query";
import {
  listRecipes,
  readFile,
  openFolder as openFolderInOS,
} from "@/lib/tauri";
import { globalTipQueue } from "@tg/tip-engine";
import { FullscreenPreview } from "../components/FullscreenPreview";
import { IterateScreen } from "../IterateScreen";
import { ShareSection } from "../components/ShareSection";
import { VerifyHint } from "../components/VerifyHint";
import type { VerifyKind } from "@/lib/tauri";
import { useApp } from "../state";
import { useGuidance } from "@/lib/guidance";

export function Artifact() {
  const { data: recipes } = useQuery({
    queryKey: ["recipes"],
    queryFn: listRecipes,
  });
  const selectedId = useApp((s) => s.selectedRecipeId);
  const activeRun = useApp((s) => s.activeRun);
  const finishOnboarding = useApp((s) => s.finishOnboarding);
  const bumpRun = useGuidance((s) => s.bumpRun);

  const recipe = useMemo(
    () =>
      recipes?.find((r) => r.id === selectedId) ?? recipes?.[0] ?? null,
    [recipes, selectedId],
  );

  const path = activeRun?.artifactPath;
  const isHtml = path?.endsWith(".html") ?? false;

  // 파일 미리보기 (HTML 만).
  const { data: fileContents } = useQuery({
    queryKey: ["artifact", path],
    queryFn: () => (path ? readFile(path) : Promise.resolve("")),
    enabled: !!path && isHtml,
  });

  // path 가 set 되어야만 confetti + bump 발화. setArtifactPath 가 이미 projects 추가까지 처리.
  const recordedRef = useRef(false);
  useEffect(() => {
    if (recordedRef.current) return;
    if (!path) return; // race 방어 — path 가 zustand 에 반영되기 전엔 대기
    recordedRef.current = true;
    void confetti({ particleCount: 160, spread: 80, origin: { y: 0.55 } });
    bumpRun();
  }, [path, bumpRun]);

  const notifyFail = (msg: string) =>
    globalTipQueue.enqueue({
      id: `artifact-fail-${Date.now()}`,
      pattern: "위로형",
      trigger: "상태",
      priority: 2,
      message: msg,
      ttlMs: 8000,
    });

  const [fullscreen, setFullscreen] = useState(false);
  const [iterating, setIterating] = useState(false);

  // setArtifactPath 가 atomic 으로 projectId 까지 묶어둠 — race 없음.
  const myProjectId = activeRun?.projectId ?? "";

  const openInBrowser = () => {
    if (!path) {
      notifyFail("이 작품엔 파일 경로가 없어요.");
      return;
    }
    setFullscreen(true);
  };

  const openFolder = async () => {
    if (!path) return;
    const ok = await openFolderInOS(path);
    if (!ok) notifyFail("폴더는 데스크톱 앱에서만 열려요.");
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl w-full px-6 py-10"
    >
      <header className="mb-6 text-center">
        <p className="text-4xl mb-3" aria-hidden>
          🎉
        </p>
        <h2 className="text-2xl font-semibold text-ink mb-1">만들었어요!</h2>
        <p className="text-subtle text-sm">
          {recipe ? `당신이 만든 첫 ${recipe.title} 이에요.` : "첫 결과물이 나왔어요."}
        </p>
      </header>

      {/* 비-HTML 결과물 안내 */}
      <VerifyHint
        kind={recipe?.verifyKind as VerifyKind | undefined}
        folderPath={path}
        runCommand={recipe?.runCommand}
        localUrl={recipe?.localUrl}
        recipeId={recipe?.id}
      />

      {isHtml && fileContents && (
        <div className="rounded-2xl border border-subtle/15 bg-surface overflow-hidden mb-5">
          <div className="px-4 py-2 border-b border-subtle/10 text-xs text-subtle">
            미리보기
          </div>
          <iframe
            title="결과물 미리보기"
            srcDoc={fileContents}
            sandbox=""
            className="w-full h-72 bg-white"
          />
        </div>
      )}

      {path && (
        <p className="text-center text-[11px] text-subtle font-mono mb-5 truncate">
          📁 {path}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
        <button
          type="button"
          onClick={openInBrowser}
          disabled={!path}
          className="px-4 py-3 rounded-xl bg-primary text-white font-medium hover:opacity-90 disabled:opacity-50"
        >
          🌐 브라우저에서 크게 보기
        </button>
        <button
          type="button"
          onClick={openFolder}
          disabled={!path}
          className="px-4 py-3 rounded-xl bg-surface border border-subtle/20 hover:border-primary/40 disabled:opacity-50"
        >
          📁 폴더 열기
        </button>
      </div>

      {/* 친구한테 보여주기 — Stage 8 */}
      {path && (
        <div className="mb-5">
          <ShareSection
            path={path}
            verifyKind={recipe?.verifyKind}
            localUrl={recipe?.localUrl}
          />
        </div>
      )}

      <section className="rounded-2xl bg-primary/5 border border-primary/20 p-5 mb-6">
        <h3 className="font-semibold text-ink text-sm mb-2">
          다음에 뭘 해볼래요?
        </h3>
        <p className="text-xs text-subtle mb-3">
          AI한테 한 줄로 부탁하면 제가 코드를 받아 자동으로 반영해드려요.
          색깔·사진·버튼 — 뭐든.
        </p>
        <button
          type="button"
          onClick={() => {
            if (!path) {
              notifyFail(
                "수정할 파일 경로가 안 잡혔어요. 자동 모드로 다시 만든 뒤 시도해주세요.",
              );
              return;
            }
            setIterating(true);
          }}
          className="w-full px-4 py-3 rounded-xl bg-primary text-white font-medium hover:opacity-90"
        >
          🔄 수정하기 (반복 개발)
        </button>
        {!path && (
          <p className="text-[10px] text-warning mt-2">
            ⚠️ 파일 경로가 아직 없어요. 자동 모드로 다시 만든 뒤 다시 들어와주세요.
          </p>
        )}
        <ul className="text-[11px] text-subtle mt-3 space-y-0.5 list-disc list-inside">
          <li>예: "배경색을 분홍색으로 바꿔줘"</li>
          <li>예: "사진 자리를 하나 더 추가해줘"</li>
          <li>변경할 때마다 자동 저장 — 언제든 되돌릴 수 있어요</li>
        </ul>
      </section>

      <button
        type="button"
        onClick={finishOnboarding}
        className="w-full px-6 py-3 rounded-xl bg-success text-white font-medium hover:opacity-90"
      >
        Vibemate 메인으로 →
      </button>

      <FullscreenPreview
        path={path ?? null}
        open={fullscreen}
        onClose={() => setFullscreen(false)}
      />

      <IterateScreen
        projectId={myProjectId}
        path={path ?? ""}
        open={iterating && !!path}
        onClose={() => setIterating(false)}
      />
    </motion.section>
  );
}

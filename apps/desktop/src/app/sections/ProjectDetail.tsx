// 프로젝트 상세 — main shell 에서 작품 카드 클릭 시 보이는 화면.
// Artifact 와 동일한 5개 액션을 한 곳에 모음: 미리보기 + 폴더 + 터미널 + Claude Code + 수정.

import { useState } from "react";
import { motion } from "framer-motion";
import type { ProjectRecord } from "@/lib/projects";
import { useApp } from "../state";
import { FolderBar } from "../components/FolderBar";
import { FullscreenPreview } from "../components/FullscreenPreview";
import { IterateScreen } from "../IterateScreen";
import { ConfirmModal } from "../components/ConfirmModal";
import { ShareSection } from "../components/ShareSection";
import { VerifyHint } from "../components/VerifyHint";
import { useQuery } from "@tanstack/react-query";
import { listRecipes, type VerifyKind } from "@/lib/tauri";

interface Props {
  project: ProjectRecord;
  onBack: () => void;
}

export function ProjectDetail({ project, onBack }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [iterating, setIterating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const removeProjectFully = useApp((s) => s.removeProjectFully);
  const { data: recipes } = useQuery({
    queryKey: ["recipes"],
    queryFn: listRecipes,
  });
  const recipe = recipes?.find((r) => r.id === project.recipeId);

  const handleDelete = () => {
    removeProjectFully(project.id, project.artifactPath);
    setPendingDelete(false);
    onBack();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-3xl"
    >
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-subtle hover:text-ink mb-4 flex items-center gap-1"
      >
        ← 작품 목록으로
      </button>

      <header className="mb-6">
        <p className="text-xs text-subtle mb-1">{project.recipeTitle}</p>
        <h1 className="text-2xl font-bold text-ink mb-1">{project.label}</h1>
        <p className="text-[11px] font-mono text-subtle truncate">
          {project.artifactPath ?? "(파일 경로 없음)"}
        </p>
      </header>

      {/* 폴더 정보 + 폴더/터미널/Claude Code 3 버튼 */}
      {project.artifactPath && (
        <div className="mb-5">
          <FolderBar pathOrFolder={project.artifactPath} isFilePath />
        </div>
      )}

      {/* 비-HTML 결과물 안내 */}
      <VerifyHint
        kind={recipe?.verifyKind as VerifyKind | undefined}
        folderPath={project.artifactPath}
        runCommand={recipe?.runCommand}
        localUrl={recipe?.localUrl}
        recipeId={recipe?.id}
      />

      {/* 미리보기 + 수정 + 삭제 */}
      <section className="rounded-2xl bg-surface border border-subtle/15 p-5 mb-5">
        <h2 className="font-semibold text-ink text-sm mb-3">작품 보기·수정</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            disabled={!project.artifactPath}
            className="px-4 py-3 rounded-xl bg-primary text-white font-medium hover:opacity-90 disabled:opacity-50"
          >
            🌐 풀스크린 미리보기
          </button>
          <button
            type="button"
            onClick={() => setIterating(true)}
            disabled={!project.artifactPath}
            className="px-4 py-3 rounded-xl bg-success text-white font-medium hover:opacity-90 disabled:opacity-50"
          >
            🔄 수정하기 (반복 개발)
          </button>
        </div>
        <p className="text-[11px] text-subtle">
          AI한테 한 줄로 부탁하면 색깔·사진·버튼 — 뭐든 바꿔드려요. 변경할 때마다
          자동 저장.
        </p>
      </section>

      {/* 친구한테 보여주기 */}
      {project.artifactPath && (
        <div className="mb-5">
          <ShareSection
            path={project.artifactPath}
            verifyKind={recipe?.verifyKind}
            localUrl={recipe?.localUrl}
          />
        </div>
      )}

      {/* 다음에 뭘 해볼래요 */}
      <section className="rounded-2xl bg-primary/5 border border-primary/20 p-5 mb-5">
        <h2 className="font-semibold text-ink text-sm mb-2">
          이런 것도 가능해요
        </h2>
        <ul className="text-sm text-ink/90 space-y-1.5 list-disc list-inside">
          <li>
            <strong>📂 폴더 열기</strong> — 손으로 사진 드래그해서 넣기
          </li>
          <li>
            <strong>💻 터미널 열기</strong> — 직접 명령어 입력
          </li>
          <li>
            <strong>🤖 Claude Code 시작</strong> — 그 폴더에서 AI 와 직접 대화
          </li>
          <li>
            <strong>🔄 수정하기</strong> — 자동 모드로 한 줄 부탁
          </li>
        </ul>
      </section>

      {/* 위험 영역 */}
      <details className="rounded-2xl bg-surface border border-subtle/15 p-4">
        <summary className="text-xs text-subtle cursor-pointer">
          ⚠️ 위험 영역 — 기록 지우기
        </summary>
        <p className="text-[11px] text-subtle mt-2 mb-2">
          가디언의 작품 기록만 지웁니다. 실제 폴더·파일은 그대로 남아있어요.
        </p>
        <button
          type="button"
          onClick={() => setPendingDelete(true)}
          className="text-xs px-3 py-1.5 rounded-lg bg-error/10 text-error hover:bg-error/20"
        >
          기록 지우기
        </button>
      </details>

      <FullscreenPreview
        path={project.artifactPath ?? null}
        open={previewOpen && !!project.artifactPath}
        onClose={() => setPreviewOpen(false)}
      />

      <IterateScreen
        projectId={project.id}
        path={project.artifactPath ?? ""}
        open={iterating && !!project.artifactPath}
        onClose={() => setIterating(false)}
      />

      <ConfirmModal
        open={pendingDelete}
        title="이 기록을 지울까요?"
        message={`"${project.label}" 기록만 사라져요. 실제 폴더는 그대로 남아있습니다.`}
        danger
        confirmLabel="지우기"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(false)}
      />
    </motion.div>
  );
}

import { useState } from "react";
import { useProjects, type ProjectRecord } from "@/lib/projects";
import { useApp } from "../state";
import { ProjectCard, type ProjectCardAction } from "../components/ProjectCard";
import { ProjectDetail } from "./ProjectDetail";

export function Projects() {
  const [detailId, setDetailId] = useState<string | null>(null);
  const projects = useProjects();
  const setSection = useApp((s) => s.setSection);

  const detail = detailId ? projects.find((p) => p.id === detailId) : null;

  const handleAction = (action: ProjectCardAction, p: ProjectRecord) => {
    if (
      action === "open" ||
      action === "edit" ||
      action === "folder" ||
      action === "detail"
    ) {
      // 모든 액션이 detail 화면에서 가능 — 클릭 시 상세로.
      setDetailId(p.id);
    }
  };

  if (detail) {
    return <ProjectDetail project={detail} onBack={() => setDetailId(null)} />;
  }

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink mb-1">프로젝트</h1>
        <p className="text-sm text-subtle">
          작품을 클릭하면 폴더·터미널·수정 모두 볼 수 있어요.
        </p>
      </header>

      {projects.length === 0 ? (
        <div className="rounded-2xl bg-surface border border-subtle/15 p-8 text-center">
          <p className="text-4xl mb-3" aria-hidden>
            📁
          </p>
          <p className="text-sm text-ink mb-1">아직 만든 게 없어요</p>
          <p className="text-xs text-subtle mb-4">
            레시피에서 첫 프로젝트를 시작하면 여기에 자동으로 정리됩니다.
          </p>
          <button
            type="button"
            onClick={() => setSection("recipes")}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90"
          >
            레시피 보러 가기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              actions={["detail"]}
              onAction={handleAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

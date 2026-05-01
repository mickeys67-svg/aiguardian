// 프로젝트 카드 — Home / Projects / Artifact 가 공통으로 쓰는 카드 + 액션.
// 이전엔 3 곳에 거의 동일 코드가 중복돼 일관성 깨짐 + 변경 누락 위험.

import type { ProjectRecord } from "@/lib/projects";
import { relativeTime } from "@/lib/projects";

export type ProjectCardAction = "open" | "edit" | "folder" | "remake" | "delete" | "detail";

interface Props {
  project: ProjectRecord;
  /** 보여줄 액션 — 호출자별로 선택. 디폴트는 모두. */
  actions?: ProjectCardAction[];
  /** 액션 클릭 핸들러. project + action 받음. */
  onAction: (action: ProjectCardAction, project: ProjectRecord) => void;
  /** 작은 변형 (Home의 미니 카드) vs 큰 변형 (Projects 의 행) */
  compact?: boolean;
}

const DEFAULT_ACTIONS: ProjectCardAction[] = ["open", "edit", "folder", "remake"];

const ACTION_LABEL: Record<ProjectCardAction, string> = {
  open: "열기",
  edit: "🔄 수정",
  folder: "폴더",
  remake: "다시 만들기",
  delete: "기록 지우기",
  detail: "자세히 →",
};

const ACTION_STYLE: Record<ProjectCardAction, string> = {
  open: "bg-primary text-white hover:opacity-90",
  edit: "bg-success text-white hover:opacity-90",
  folder: "bg-surface border border-subtle/20 hover:border-primary/40",
  remake: "bg-surface border border-subtle/20 hover:border-primary/40",
  delete: "text-subtle hover:text-error",
  detail: "bg-surface border border-subtle/20 hover:border-primary/40",
};

export function ProjectCard({
  project,
  actions = DEFAULT_ACTIONS,
  onAction,
  compact = false,
}: Props) {
  return (
    <article
      className={`rounded-2xl bg-surface border border-subtle/15 ${
        compact ? "p-4" : "p-4"
      }`}
    >
      <div className={compact ? "" : "flex items-start justify-between gap-4"}>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-subtle mb-1">
            {relativeTime(project.createdAt)}
            {!compact && ` · ${project.recipeTitle}`}
          </p>
          <h3 className="font-semibold text-ink text-sm mb-1">
            {project.label}
          </h3>
          {!compact && project.artifactPath && (
            <p className="text-[11px] font-mono text-subtle/80 truncate">
              {project.artifactPath}
            </p>
          )}
        </div>
        {!compact && (
          <ActionButtons
            project={project}
            actions={actions}
            onAction={onAction}
            vertical
          />
        )}
      </div>
      {compact && (
        <ActionButtons
          project={project}
          actions={actions}
          onAction={onAction}
        />
      )}
    </article>
  );
}

function ActionButtons({
  project,
  actions,
  onAction,
  vertical = false,
}: {
  project: ProjectRecord;
  actions: ProjectCardAction[];
  onAction: (a: ProjectCardAction, p: ProjectRecord) => void;
  vertical?: boolean;
}) {
  // artifactPath 없는 액션은 비활성.
  const needsPath: ProjectCardAction[] = ["open", "edit", "folder"];

  return (
    <div
      className={
        vertical
          ? "flex flex-col gap-1.5 shrink-0"
          : "flex flex-wrap gap-1.5 mt-2"
      }
    >
      {actions.map((a) => {
        const disabled = needsPath.includes(a) && !project.artifactPath;
        if (disabled) return null;
        const isSmallText = a === "delete";
        return (
          <button
            key={a}
            type="button"
            onClick={() => onAction(a, project)}
            className={
              isSmallText
                ? `text-[11px] ${ACTION_STYLE[a]}`
                : `text-xs px-3 py-1 rounded-lg ${ACTION_STYLE[a]} transition`
            }
          >
            {ACTION_LABEL[a]}
          </button>
        );
      })}
    </div>
  );
}

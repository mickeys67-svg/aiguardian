import { motion } from "framer-motion";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEnvironment } from "@/lib/hooks";
import { useOnboarding } from "../state";
import { installTool, type AiClientStatus, type ToolStatus } from "@/lib/tauri";
import { Tooltip } from "../components/Tooltip";
import { InfoPanel } from "../components/InfoPanel";
import { AutoTerm } from "../components/AutoTerm";
import { ConfirmModal } from "../components/ConfirmModal";

const AI_LABEL: Record<AiClientStatus["name"], string> = {
  claude_desktop: "Claude Desktop",
  claude_code: "Claude Code",
  cursor: "Cursor",
};

// 도구 이름 → 글로서리 키 매핑.
const TOOL_GLOSSARY: Record<string, string> = {
  node: "Node",
  git: "Git",
  npm: "npm",
};

export function Result() {
  const { data, refetch } = useEnvironment();
  const next = useOnboarding((s) => s.next);
  const qc = useQueryClient();
  const [installing, setInstalling] = useState<string | null>(null);
  const [installLog, setInstallLog] = useState<Record<string, string>>({});
  const [confirmAll, setConfirmAll] = useState(false);
  const [openInfo, setOpenInfo] = useState<string | null>(null);

  if (!data) {
    return (
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-md w-full px-6 py-10 text-center"
      >
        <p className="text-4xl mb-4" aria-hidden>
          🤔
        </p>
        <h2 className="text-xl font-semibold text-ink mb-2">
          진단 결과가 아직 없어요
        </h2>
        <p className="text-subtle text-sm mb-6">
          진단을 건너뛰셨거나 데이터가 비어있어요. 계속하려면 한 번 더 살펴볼까요?
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={async () => {
              await refetch();
            }}
            className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90"
          >
            🔄 다시 진단
          </button>
          <button
            type="button"
            onClick={() => next()}
            className="px-4 py-2.5 rounded-xl bg-surface border border-subtle/20 text-sm text-subtle hover:text-ink"
          >
            ⏭ 그냥 진행 (수동으로 알려드릴게요)
          </button>
        </div>
      </motion.section>
    );
  }

  const tools: ToolStatus[] = [...data.runtimes, ...data.packageManagers];
  const ready = tools.filter((t) => t.installed).length;
  const total = tools.length;
  const missing = tools.filter((t) => !t.installed);

  /** 환경 캐시 한 번만 무효화 — installAll/installOne 마지막에 공통 호출. */
  const refreshEnv = async () => {
    await qc.invalidateQueries({ queryKey: ["environment"] });
    await refetch();
  };

  const runInstall = async (toolName: string) => {
    setInstalling(toolName);
    try {
      const r = await installTool(toolName);
      setInstallLog((l) => ({
        ...l,
        [toolName]: r.success ? "✅ 설치 완료" : `⚠️ ${r.stderr || r.stdout}`,
      }));
    } catch (e) {
      setInstallLog((l) => ({
        ...l,
        [toolName]: `⚠️ ${
          typeof e === "string" ? e : (e as Error).message
        }`,
      }));
    } finally {
      setInstalling(null);
    }
  };

  const installOne = async (toolName: string) => {
    await runInstall(toolName);
    await refreshEnv();
  };

  const installAll = async () => {
    setConfirmAll(false);
    for (const t of missing) {
      await runInstall(t.name);
    }
    // 마지막에 한 번만 환경 새로고침.
    await refreshEnv();
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl w-full px-6 py-10"
    >
      <header className="mb-8 text-center">
        <h2 className="text-2xl font-semibold text-ink mb-2">
          {ready === total
            ? "모든 도구가 준비됐어요!"
            : `${missing.length}개만 더 깔면 됩니다`}
        </h2>
        <p className="text-subtle text-sm">
          OS: {data.os.toUpperCase()} {data.shell ? `· ${data.shell}` : ""}
        </p>
      </header>

      {missing.length > 0 && (
        <div className="mb-6 rounded-2xl bg-primary/5 border border-primary/20 p-4 flex items-center gap-3">
          <span className="text-2xl" aria-hidden>
            🛠
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-ink">
              괜찮으면 제가 한 번에 깔아드릴게요
            </p>
            <p className="text-xs text-subtle">
              약 5분, 인터넷 필요. 공식 사이트에서만 받아요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmAll(true)}
            disabled={installing !== null}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50 hover:opacity-90"
          >
            {installing ? "깔고 있어요..." : "한 번에 깔기"}
          </button>
        </div>
      )}

      <h3 className="text-sm font-medium text-subtle mb-3 px-1">개발 도구</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {tools.map((t) => (
          <ToolCard
            key={t.name}
            tool={t}
            log={installLog[t.name]}
            installing={installing === t.name}
            onInstall={() => installOne(t.name)}
            onInfo={() => {
              const k = TOOL_GLOSSARY[t.name.toLowerCase()];
              if (k) setOpenInfo(k);
            }}
          />
        ))}
      </div>

      <h3 className="text-sm font-medium text-subtle mb-3 px-1">AI 도구</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
        {data.aiClients.map((c) => (
          <AiCard
            key={c.name}
            client={c}
            label={AI_LABEL[c.name]}
            onInfo={() =>
              setOpenInfo(c.name === "claude_code" ? "Claude Code" : "MCP")
            }
          />
        ))}
      </div>

      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={next}
          className="px-6 py-3 rounded-xl bg-primary text-white font-medium shadow-sm hover:opacity-90 transition"
        >
          다음 →
        </button>
      </div>

      <p className="text-center text-xs text-subtle mt-6">
        진단 시각: {new Date(data.lastScanned).toLocaleString("ko-KR")}
        {data.cached ? " (24시간 내 캐시 사용)" : ""}
      </p>

      <ConfirmModal
        open={confirmAll}
        title="이 도구들을 깔게요"
        message={`${missing.length}개의 도구를 한 번에 깝니다: ${missing
          .map((t) => t.name)
          .join(", ")}`}
        safeNote="공식 사이트에서만 받아요. 약 5분 걸려요."
        warnNote="인터넷 연결이 필요해요."
        confirmLabel="시작"
        onConfirm={() => void installAll()}
        onCancel={() => setConfirmAll(false)}
      />

      <InfoPanel term={openInfo} onClose={() => setOpenInfo(null)} />
    </motion.section>
  );
}

function ToolCard({
  tool,
  log,
  installing,
  onInstall,
  onInfo,
}: {
  tool: ToolStatus;
  log?: string;
  installing: boolean;
  onInstall: () => void;
  onInfo: () => void;
}) {
  const known = !!TOOL_GLOSSARY[tool.name.toLowerCase()];
  return (
    <article
      className={`rounded-2xl p-4 bg-surface border ${
        tool.installed ? "border-success/30" : "border-warning/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="font-semibold text-ink">
              {known ? (
                <Tooltip term={TOOL_GLOSSARY[tool.name.toLowerCase()]}>
                  {tool.name}
                </Tooltip>
              ) : (
                tool.name
              )}
            </h4>
            {known && (
              <button
                type="button"
                onClick={onInfo}
                aria-label={`${tool.name} 자세히`}
                className="text-[10px] w-4 h-4 rounded-full bg-subtle/15 text-subtle hover:bg-primary/15 hover:text-primary"
              >
                ⓘ
              </button>
            )}
          </div>
          <p className="text-xs text-subtle mt-0.5">
            <AutoTerm>{tool.friendlyDescription}</AutoTerm>
          </p>
        </div>
        <span
          aria-label={tool.installed ? "설치됨" : "곧 설치 가능"}
          className={`text-xl leading-none ${
            tool.installed ? "text-success" : "text-primary"
          }`}
          title={tool.installed ? "이미 설치됨" : "이걸 깔아드릴게요"}
        >
          {tool.installed ? "✅" : "➕"}
        </span>
      </div>
      {tool.version && (
        <p className="mt-2 text-[11px] text-subtle font-mono truncate">
          {tool.version}
        </p>
      )}
      {!tool.installed && (
        <button
          type="button"
          onClick={onInstall}
          disabled={installing}
          className="mt-3 w-full px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50 hover:opacity-90"
        >
          {installing ? "깔고 있어요..." : "지금 깔게요"}
        </button>
      )}
      {log && <p className="mt-2 text-[11px] text-subtle truncate">{log}</p>}
    </article>
  );
}

function AiCard({
  client,
  label,
  onInfo,
}: {
  client: AiClientStatus;
  label: string;
  onInfo: () => void;
}) {
  return (
    <article
      className={`rounded-2xl p-4 bg-surface border ${
        client.mcpReady ? "border-success/30" : "border-subtle/20"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-ink">{label}</h4>
        <button
          type="button"
          onClick={onInfo}
          aria-label={`${label} 자세히`}
          className="text-[10px] w-4 h-4 rounded-full bg-subtle/15 text-subtle hover:bg-primary/15 hover:text-primary"
        >
          ⓘ
        </button>
      </div>
      <p className="text-xs text-subtle mt-1">
        {client.installed ? "설치됨" : "미설치"}
        {client.mcpReady ? " · 다리 연결 가능" : ""}
      </p>
    </article>
  );
}

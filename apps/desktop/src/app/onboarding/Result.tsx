import { motion } from "framer-motion";
import { useEnvironment } from "@/lib/hooks";
import { useOnboarding } from "../state";
import type { AiClientStatus, ToolStatus } from "@/lib/tauri";

const AI_LABEL: Record<AiClientStatus["name"], string> = {
  claude_desktop: "Claude Desktop",
  claude_code: "Claude Code",
  cursor: "Cursor",
};

export function Result() {
  const { data } = useEnvironment();
  const next = useOnboarding((s) => s.next);

  if (!data) return null;

  const tools: ToolStatus[] = [...data.runtimes, ...data.packageManagers];
  const ready = tools.filter((t) => t.installed).length;
  const total = tools.length;

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
            : `${ready}/${total} 준비됐어요. 부족한 건 제가 깔아드릴게요.`}
        </h2>
        <p className="text-subtle text-sm">
          OS: {data.os.toUpperCase()} {data.shell ? `· ${data.shell}` : ""}
        </p>
      </header>

      <h3 className="text-sm font-medium text-subtle mb-3 px-1">개발 도구</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {tools.map((t) => (
          <ToolCard key={t.name} tool={t} />
        ))}
      </div>

      <h3 className="text-sm font-medium text-subtle mb-3 px-1">AI 도구</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
        {data.aiClients.map((c) => (
          <AiCard key={c.name} client={c} label={AI_LABEL[c.name]} />
        ))}
      </div>

      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={next}
          className="px-6 py-3 rounded-xl bg-primary text-white font-medium shadow-sm hover:opacity-90 transition"
        >
          좋아요, 다음으로
        </button>
      </div>

      <p className="text-center text-xs text-subtle mt-6">
        진단 시각: {new Date(data.lastScanned).toLocaleString("ko-KR")}
        {data.cached ? " (24시간 내 캐시 사용)" : ""}
      </p>
    </motion.section>
  );
}

function ToolCard({ tool }: { tool: ToolStatus }) {
  return (
    <article
      className={`rounded-2xl p-4 bg-surface border ${
        tool.installed ? "border-success/30" : "border-warning/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-ink">{tool.name}</h4>
          <p className="text-xs text-subtle mt-0.5">{tool.friendlyDescription}</p>
        </div>
        <span
          aria-label={tool.installed ? "설치됨" : "미설치"}
          className={`text-xl leading-none ${
            tool.installed ? "text-success" : "text-warning"
          }`}
        >
          {tool.installed ? "✅" : "⚠️"}
        </span>
      </div>
      {tool.version && (
        <p className="mt-2 text-[11px] text-subtle font-mono truncate">
          {tool.version}
        </p>
      )}
    </article>
  );
}

function AiCard({
  client,
  label,
}: {
  client: AiClientStatus;
  label: string;
}) {
  return (
    <article
      className={`rounded-2xl p-4 bg-surface border ${
        client.mcpReady ? "border-success/30" : "border-subtle/20"
      }`}
    >
      <h4 className="font-semibold text-ink">{label}</h4>
      <p className="text-xs text-subtle mt-1">
        {client.installed ? "설치됨" : "미설치"}
        {client.mcpReady ? " · MCP 연결 가능" : ""}
      </p>
    </article>
  );
}

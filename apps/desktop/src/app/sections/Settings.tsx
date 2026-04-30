import { useState } from "react";
import { useEnvironment } from "@/lib/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { checkMcp, inspectEnvironment, type McpStatus } from "@/lib/tauri";
import { isOptedIn, setOptedIn } from "@/lib/telemetry";

const AI_LABEL: Record<McpStatus["client"], string> = {
  claude_desktop: "Claude Desktop",
  claude_code: "Claude Code",
  cursor: "Cursor",
};

export function Settings() {
  const { data: env, refetch } = useEnvironment();
  const qc = useQueryClient();
  const [telemetry, setTelemetry] = useState(isOptedIn());
  const [rescanning, setRescanning] = useState(false);

  const { data: mcpStatuses } = useQuery({
    queryKey: ["mcp-status"],
    queryFn: async () => {
      const clients: McpStatus["client"][] = [
        "claude_desktop",
        "claude_code",
        "cursor",
      ];
      return Promise.all(clients.map((c) => checkMcp(c).catch(() => null)));
    },
  });

  const handleRescan = async () => {
    setRescanning(true);
    try {
      await inspectEnvironment(true);
      await qc.invalidateQueries({ queryKey: ["environment"] });
      await refetch();
    } finally {
      setRescanning(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-ink mb-1">설정</h1>
        <p className="text-sm text-subtle">
          도구 · AI 연결 · 개인정보를 관리해요.
        </p>
      </header>

      <Section title="개인정보">
        <Row
          label="익명 사용 통계"
          hint="가디언 개선용. 명령어·파일 내용은 절대 안 보내요."
        >
          <input
            type="checkbox"
            checked={telemetry}
            onChange={(e) => {
              setTelemetry(e.target.checked);
              setOptedIn(e.target.checked);
            }}
            className="rounded text-primary focus:ring-primary/40"
          />
        </Row>
      </Section>

      <Section title="환경">
        <Row
          label="환경 다시 진단"
          hint={env ? `마지막 스캔: ${new Date(env.lastScanned).toLocaleString("ko-KR")}` : ""}
        >
          <button
            type="button"
            onClick={handleRescan}
            disabled={rescanning}
            className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50"
          >
            {rescanning ? "스캔 중..." : "지금 다시 스캔"}
          </button>
        </Row>
        <Row label="OS" hint={env?.os ?? "-"}>
          <span className="text-xs text-subtle font-mono">
            {env?.shell ?? "-"}
          </span>
        </Row>
      </Section>

      <Section title="AI 연결 (MCP)">
        {(mcpStatuses ?? []).filter(Boolean).map((status) => (
          <Row
            key={status!.client}
            label={AI_LABEL[status!.client]}
            hint={status!.configPath}
          >
            <span
              className={`text-xs font-medium ${
                status!.registered ? "text-success" : "text-subtle"
              }`}
            >
              {status!.registered ? "✅ 연결됨" : "미연결"}
            </span>
          </Row>
        ))}
      </Section>

      <Section title="앱 정보">
        <Row label="버전" hint="첫 정식 출시는 v1.0">
          <span className="text-xs font-mono text-ink">0.1.0</span>
        </Row>
        <Row label="라이선스" hint="v1.0 전 오픈소스 범위 결정">
          <span className="text-xs text-subtle">Closed Beta</span>
        </Row>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-xs font-semibold text-subtle uppercase tracking-wide mb-2 px-1">
        {title}
      </h2>
      <div className="rounded-2xl bg-surface border border-subtle/15 divide-y divide-subtle/10">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="text-[11px] text-subtle truncate">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

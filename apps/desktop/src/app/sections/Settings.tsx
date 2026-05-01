import { useState } from "react";
import { useEnvironment } from "@/lib/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  checkMcp,
  inspectEnvironment,
  registerMcp,
  type McpStatus,
} from "@/lib/tauri";
import { isOptedIn, setOptedIn } from "@/lib/telemetry";
import { useGuidance, type GuidanceMode } from "@/lib/guidance";
import { useApp } from "../state";
import { ConfirmModal } from "../components/ConfirmModal";
import { AutoTerm } from "../components/AutoTerm";
import { runStorageGc, type GcResult } from "@/lib/storageGc";
import { resetCheatsheetState } from "@/lib/cheatsheet";

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
  const [confirmReset, setConfirmReset] = useState(false);
  const [gcPreview, setGcPreview] = useState<GcResult | null>(null);
  const [confirmGc, setConfirmGc] = useState(false);
  const [gcResult, setGcResult] = useState<GcResult | null>(null);

  const guidance = useGuidance();
  const resetOnboarding = useApp((s) => s.resetOnboarding);

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

  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (client: McpStatus["client"]) => {
    setConnecting(client);
    setError(null);
    try {
      await registerMcp(client);
      await qc.invalidateQueries({ queryKey: ["mcp-status"] });
    } catch (e) {
      setError(typeof e === "string" ? e : (e as Error).message);
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="max-w-2xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-ink mb-1">설정</h1>
        <p className="text-sm text-subtle">
          안내 · AI 연결 · 개인정보를 관리해요.
        </p>
      </header>

      <Section title="안내 도움">
        <div className="px-4 py-4">
          <p className="text-sm font-medium text-ink mb-2">안내 수준</p>
          <div className="space-y-2 mb-4">
            <ModeRadio
              current={guidance.mode}
              value="full"
              icon="🟢"
              label="완전 안내 (처음이세요)"
              hint="툴팁 + 코치마크 + 토스트 + 망설임 감지"
              onChange={(m) => guidance.setMode(m)}
            />
            <ModeRadio
              current={guidance.mode}
              value="minimal"
              icon="🟡"
              label="가벼운 안내 (좀 익숙해요)"
              hint="툴팁만, 코치마크/토스트는 끔"
              onChange={(m) => guidance.setMode(m)}
            />
            <ModeRadio
              current={guidance.mode}
              value="off"
              icon="⚪"
              label="끄기 (혼자 할게요)"
              hint="ⓘ 버튼 누를 때만 도움말이 떠요"
              onChange={(m) => guidance.setMode(m)}
            />
          </div>
        </div>

        <div className="px-4 py-3">
          <p className="text-sm font-medium text-ink mb-2">세부 조절</p>
          <div className="space-y-1.5 text-sm">
            <Toggle
              checked={guidance.features.tooltip}
              onChange={(v) => guidance.setFeature("tooltip", v)}
              label="툴팁 (단어 호버)"
            />
            <Toggle
              checked={guidance.features.coachmark}
              onChange={(v) => guidance.setFeature("coachmark", v)}
              label="코치마크 (첫 방문 안내)"
            />
            <Toggle
              checked={guidance.features.hesitation}
              onChange={(v) => guidance.setFeature("hesitation", v)}
              label="망설임 감지 (60초 멈추면 도움)"
            />
            <div className="flex items-center justify-between gap-3 px-1 py-1 opacity-60 cursor-not-allowed">
              <span className="text-sm">확인 모달 (위험한 동작 전)</span>
              <span className="text-[10px] text-subtle">
                안전을 위해 끌 수 없어요
              </span>
            </div>
            <Toggle
              checked={guidance.features.autoAiChat}
              onChange={(v) => guidance.setFeature("autoAiChat", v)}
              label="에러 90초 머무르면 AI 챗 자동 열기"
            />
          </div>
        </div>

        <div className="px-4 py-3 flex gap-2">
          <button
            type="button"
            onClick={() => guidance.resetCoachmarks()}
            className="text-xs px-3 py-1.5 rounded-lg bg-surface border border-subtle/20 hover:border-primary/40"
          >
            모든 코치마크 다시 보기
          </button>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-surface border border-subtle/20 hover:border-primary/40"
          >
            온보딩 처음부터 다시 보기
          </button>
        </div>
      </Section>

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
        <Row
          label="AI에게 화면을 보낼 때"
          hint="비밀번호·이메일·API 키는 자동으로 가려져요. 이건 안전을 위해 끌 수 없어요."
        >
          <span className="text-xs text-success">✓ 항상 켜짐</span>
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

      <Section title="AI 연결">
        <p className="px-4 py-2 text-[11px] text-subtle border-b border-subtle/10">
          <AutoTerm>
            MCP 는 AI 와 컴퓨터 사이 다리예요. Claude Desktop, Claude Code, Cursor 가 가디언과 직접 대화할 수 있게 연결합니다.
          </AutoTerm>
        </p>
        {(mcpStatuses ?? []).filter(Boolean).map((status) => (
          <Row
            key={status!.client}
            label={AI_LABEL[status!.client]}
            hint={status!.configPath}
          >
            {status!.registered ? (
              <span className="text-xs font-medium text-success">
                ✅ 연결됨
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleConnect(status!.client)}
                disabled={connecting === status!.client}
                className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50 hover:opacity-90 transition"
              >
                {connecting === status!.client ? "연결 중..." : "지금 연결"}
              </button>
            )}
          </Row>
        ))}
        {error && (
          <div className="px-4 py-3 text-xs text-error bg-error/5 border-t border-error/20">
            {error}
          </div>
        )}
      </Section>

      <Section title="데이터 정리">
        <Row
          label="고아 데이터 청소"
          hint={
            gcResult
              ? `✓ ${gcResult.removed}개 키 정리됨 (${gcResult.totalKbBefore} → ${gcResult.totalKbAfter} KB)`
              : "이미 지운 작품의 잔여 스냅샷·캐시 정리"
          }
        >
          <button
            type="button"
            onClick={() => {
              const preview = runStorageGc(true);
              setGcPreview(preview);
              setConfirmGc(true);
            }}
            className="px-3 py-1 rounded-lg bg-surface border border-subtle/20 text-xs hover:border-primary/40"
          >
            지금 정리
          </button>
        </Row>
        <Row
          label="단축키 안내 다시 보기"
          hint="터미널 단축키 치트시트를 다음 진입 시 다시 띄움"
        >
          <button
            type="button"
            onClick={() => {
              resetCheatsheetState();
              alert("✓ 다음 진단·실행 화면에서 단축키 안내가 다시 떠요.");
            }}
            className="px-3 py-1 rounded-lg bg-surface border border-subtle/20 text-xs hover:border-primary/40"
          >
            리셋
          </button>
        </Row>
      </Section>

      <Section title="앱 정보">
        <Row label="버전" hint="첫 정식 출시는 v1.0">
          <span className="text-xs font-mono text-ink">0.1.0</span>
        </Row>
        <Row label="라이선스" hint="v1.0 전 오픈소스 범위 결정">
          <span className="text-xs text-subtle">Closed Beta</span>
        </Row>
      </Section>

      <ConfirmModal
        open={confirmReset}
        title="온보딩을 처음부터 다시 보시겠어요?"
        message="환영 화면부터 다시 시작해요. 만들어둔 프로젝트는 그대로 남아요."
        confirmLabel="처음부터 다시"
        onConfirm={() => {
          setConfirmReset(false);
          resetOnboarding();
        }}
        onCancel={() => setConfirmReset(false)}
      />

      <ConfirmModal
        open={confirmGc}
        title="고아 데이터를 정리할까요?"
        message={
          gcPreview
            ? `검사한 키: ${gcPreview.scanned}개 / 정리할 키: ${gcPreview.removedKeys.length}개. 현재 저장 사용량 ${gcPreview.totalKbBefore} KB.`
            : ""
        }
        safeNote="만든 작품과 진행 중 작업은 그대로 둡니다. 이미 지운 작품의 잔여만 청소."
        confirmLabel="청소"
        onConfirm={() => {
          const result = runStorageGc(false);
          setGcResult(result);
          setConfirmGc(false);
        }}
        onCancel={() => setConfirmGc(false)}
      />
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

function ModeRadio({
  current,
  value,
  icon,
  label,
  hint,
  onChange,
}: {
  current: GuidanceMode;
  value: GuidanceMode;
  icon: string;
  label: string;
  hint: string;
  onChange: (m: GuidanceMode) => void;
}) {
  const active = current === value;
  return (
    <label
      className={`flex items-start gap-3 px-3 py-2 rounded-xl cursor-pointer border transition ${
        active
          ? "border-primary/40 bg-primary/5"
          : "border-subtle/15 hover:border-subtle/30"
      }`}
    >
      <input
        type="radio"
        checked={active}
        onChange={() => onChange(value)}
        className="mt-1 text-primary focus:ring-primary/40"
      />
      <span className="flex-1">
        <span className="block text-sm font-medium text-ink">
          {icon} {label}
        </span>
        <span className="block text-[11px] text-subtle">{hint}</span>
      </span>
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 px-1 py-1 cursor-pointer">
      <span className="text-sm text-ink">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded text-primary focus:ring-primary/40"
      />
    </label>
  );
}

// "코치 켜기" 패널 — 입문자가 JSON 을 안 만지고 버튼 하나로 코치를 연결.
// (ADR-0004 "아무나 쉽게": 연결은 제품 배선이라 원클릭이 맞다.)

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { resolveResource } from "@tauri-apps/api/path";
import { coachInstalled, installCoach, uninstallCoach } from "@/lib/coachInstall";

// 번들 리소스 경로 해석: 1) localStorage 오버라이드(개발용) 2) 앱 번들 리소스(릴리스).
async function resolveBundled(overrideKey: string, resource: string): Promise<string | null> {
  const override = localStorage.getItem(overrideKey);
  if (override) return override;
  try {
    return await resolveResource(resource);
  } catch {
    return null;
  }
}

/** 훅이 실행할 stop-hook 스크립트. 없으면 연결 불가(번들 단계 필요). */
function resolveStopPath(): Promise<string | null> {
  return resolveBundled("tg.coach.scriptPath", "coach/tg-coach-stop.mjs");
}

/** 세션 AI가 호출할 coach MCP 서버. 없으면 훅만 켜짐(격려·아이디어 자동 채움은 비활성). */
function resolveMcpPath(): Promise<string | null> {
  return resolveBundled("tg.coach.mcpPath", "coach/tg-coach-mcp.mjs");
}

export function CoachConnect() {
  const qc = useQueryClient();
  const [scriptPath, setScriptPath] = useState<string | null>(null);
  const [mcpPath, setMcpPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void resolveStopPath().then(setScriptPath);
    void resolveMcpPath().then(setMcpPath);
  }, []);

  const { data: installed } = useQuery({
    queryKey: ["coach-installed"],
    queryFn: coachInstalled,
  });

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (installed) await uninstallCoach();
      else if (scriptPath) await installCoach(scriptPath, mcpPath);
      await qc.invalidateQueries({ queryKey: ["coach-installed"] });
    } catch (e) {
      setError(typeof e === "string" ? e : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const ready = installed || scriptPath;

  return (
    <section className="mb-6 rounded-2xl bg-surface border border-subtle/15 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink mb-0.5">코치 연결</h2>
          <p className="text-xs text-subtle">
            {installed
              ? mcpPath
                ? "✅ 켜짐 · 한 턴을 끝낼 때마다 코치가 짚어주고, 잘된 경우엔 격려와 다음 선택지도 채워줘요."
                : "✅ 켜짐(기본) · 사실 안내는 떠요. 맞춤 격려·아이디어는 MCP 번들 후 켜져요."
              : "Claude Code 에 코치를 붙여요. 설정 파일은 앱이 알아서 써드려요."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy || !ready}
          className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 ${
            installed
              ? "bg-bg text-subtle border border-subtle/20 hover:text-ink"
              : "bg-primary text-white hover:opacity-90"
          }`}
        >
          {busy ? "처리 중..." : installed ? "코치 끄기" : "코치 켜기"}
        </button>
      </div>

      {!installed && !scriptPath && (
        <p className="mt-2 text-[11px] text-warning">
          ⚠️ 아직 코치 스크립트가 앱에 번들되지 않았어요(릴리스 빌드 단계). 개발 중엔
          <code className="mx-1 px-1 rounded bg-bg">localStorage["tg.coach.scriptPath"]</code>
          로 경로를 지정하면 켤 수 있어요.
        </p>
      )}
      {error && <p className="mt-2 text-[11px] text-error">{error}</p>}
    </section>
  );
}

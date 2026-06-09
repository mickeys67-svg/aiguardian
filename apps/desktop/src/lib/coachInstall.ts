// "코치 켜기" 오케스트레이션 — 사용자 대신 ~/.claude/settings.json 을 읽어
// 코치 Stop 훅을 넣고/빼고 다시 쓴다. JSON 손편집을 앱이 흡수한다. (ADR-0004)
//
// 병합 로직 자체는 @tg/coach/install(순수·테스트됨). 여기선 파일 IO만 담당.

import { homeDir } from "@tauri-apps/api/path";
import {
  addCoachStopHook,
  removeCoachStopHook,
  hasCoachStopHook,
  coachStopCommand,
  addCoachMcpServer,
  removeCoachMcpServer,
} from "@tg/coach/install";
import { readFile, writeFile } from "./tauri";

const SETTINGS_REL = ".claude/settings.json";

async function settingsPath(): Promise<string> {
  const home = (await homeDir()).replace(/[\\/]+$/, "");
  return `${home}/${SETTINGS_REL}`;
}

async function readRaw(path: string): Promise<string> {
  try {
    return await readFile(path);
  } catch {
    return "";
  }
}

function parse(raw: string): Record<string, unknown> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** 현재 코치가 켜져 있나(Claude Code Stop 훅 기준). */
export async function coachInstalled(): Promise<boolean> {
  return hasCoachStopHook(parse(await readRaw(await settingsPath())));
}

/**
 * 코치 켜기 — Stop 훅 + coach MCP 서버를 '한 쌍'으로 등록. 기존 settings 는 .bak 백업.
 *  - 훅: 잘된 턴의 사실층을 0초로(침묵 방지).
 *  - MCP: 세션 AI가 coach_review 를 호출해 격려·아이디어를 맥락으로 채우는 통로.
 * 둘 중 하나만 켜면 효과 0(훅만=캔 양산 / MCP만=자동성 결손)이라 함께 켠다.
 * mcpScriptPath 가 아직 번들 안 돼 null 이면 훅만 켜고 진행(graceful).
 */
export async function installCoach(
  stopScriptPath: string,
  mcpScriptPath?: string | null,
): Promise<string> {
  const path = await settingsPath();
  const raw = await readRaw(path);
  if (raw) {
    try {
      await writeFile(`${path}.bak`, raw);
    } catch {
      /* 백업 실패해도 설치는 진행(원본 손상 아님) */
    }
  }
  let next = addCoachStopHook(parse(raw), coachStopCommand(stopScriptPath));
  if (mcpScriptPath) next = addCoachMcpServer(next, mcpScriptPath);
  await writeFile(path, JSON.stringify(next, null, 2) + "\n");
  return path;
}

/** 코치 끄기 — 코치 훅 + MCP 서버만 제거(사용자의 다른 훅·서버·설정 보존) + HUD 상태 비우기. */
export async function uninstallCoach(): Promise<string> {
  const path = await settingsPath();
  const next = removeCoachMcpServer(removeCoachStopHook(parse(await readRaw(path))));
  await writeFile(path, JSON.stringify(next, null, 2) + "\n");
  await clearCoachState(); // 끄면 마지막 코칭이 HUD 에 남지 않게(프라이버시·혼란 방지)
  return path;
}

/** HUD 상태파일(~/.tg-coach/latest-turn.json)을 빈 코칭으로 덮어 잔류를 없앤다. 실패해도 무해. */
async function clearCoachState(): Promise<void> {
  try {
    const home = (await homeDir()).replace(/[\\/]+$/, "");
    const cleared = { updatedAt: new Date().toISOString(), source: "uninstalled", buckets: [], phase: "facts" };
    await writeFile(`${home}/.tg-coach/latest-turn.json`, JSON.stringify(cleared, null, 2));
  } catch {
    /* 파일이 없거나 못 써도 무해 — 다음 turn 이 덮거나 HUD 가 빈 buckets 를 안 띄운다 */
  }
}

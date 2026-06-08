// "코치 켜기" 설치 로직 — Claude Code settings.json 에 Stop 훅을 넣고/빼는 순수 함수.
//
// 사용자는 이걸 직접 안 만진다. 앱의 "코치 켜기" 버튼이 settings.json 을 읽어
// 이 함수로 병합한 뒤 다시 쓴다. (JSON 손편집 제거 — ADR-0004 "아무나 쉽게")
//
// 순수 객체 변환이라 node 의존 없음 → 브라우저(데스크톱 앱)에서도 안전.

type Json = Record<string, unknown>;

interface HookCmd {
  type: "command";
  command: string;
}
interface HookGroup {
  hooks?: HookCmd[];
  [k: string]: unknown;
}

/** 우리 코치 훅을 알아보는 표식 — 명령 경로에 항상 들어간다. */
const COACH_MARK = "tg-coach";

/**
 * 훅이 실행할 명령. scriptPath = 번들된 stop-hook 스크립트 절대경로.
 * 식별을 위해 경로에 표식("tg-coach")이 포함돼야 한다(없으면 식별 인자 부착).
 */
export function coachStopCommand(scriptPath: string): string {
  const node = `node "${scriptPath}"`;
  return scriptPath.includes(COACH_MARK) ? node : `${node} --${COACH_MARK}`;
}

function stopGroups(settings: Json): HookGroup[] {
  const hooks = settings.hooks as Json | undefined;
  const stop = hooks?.Stop;
  return Array.isArray(stop) ? (stop as HookGroup[]) : [];
}

function isCoachCmd(h: HookCmd): boolean {
  return typeof h?.command === "string" && h.command.includes(COACH_MARK);
}

/** 이미 코치 Stop 훅이 들어 있나. */
export function hasCoachStopHook(settings: Json | null | undefined): boolean {
  if (!settings) return false;
  return stopGroups(settings).some(
    (g) => Array.isArray(g.hooks) && g.hooks.some(isCoachCmd),
  );
}

/** 코치 Stop 훅을 추가(없을 때만). 다른 훅/설정은 보존. 새 객체 반환. */
export function addCoachStopHook(settings: Json | null | undefined, command: string): Json {
  const next: Json = { ...(settings ?? {}) };
  if (hasCoachStopHook(next)) return next;
  const hooks: Json = { ...((next.hooks as Json) ?? {}) };
  const stop = stopGroups(next);
  hooks.Stop = [...stop, { hooks: [{ type: "command", command }] }];
  next.hooks = hooks;
  return next;
}

/** 코치 Stop 훅만 제거. 사용자의 다른 훅은 보존. 빈 구조는 정리. 새 객체 반환. */
export function removeCoachStopHook(settings: Json | null | undefined): Json {
  const next: Json = { ...(settings ?? {}) };
  const hooksObj = next.hooks as Json | undefined;
  if (!hooksObj || !Array.isArray(hooksObj.Stop)) return next;

  const hooks: Json = { ...hooksObj };
  const cleaned = (hooks.Stop as HookGroup[])
    .map((g) => ({
      ...g,
      hooks: (g.hooks ?? []).filter((h) => !isCoachCmd(h)),
    }))
    .filter((g) => (g.hooks?.length ?? 0) > 0);

  if (cleaned.length === 0) delete hooks.Stop;
  else hooks.Stop = cleaned;

  if (Object.keys(hooks).length === 0) delete next.hooks;
  else next.hooks = hooks;
  return next;
}

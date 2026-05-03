// 텔레메트리 — 옵트인 + 화이트리스트 기반.
//
// 데이터 카테고리 SoT: docs/legal/data-categories.md
// 처리방침: docs/legal/privacy-policy.md §2.1
//
// 설계 원칙
// 1) 사용자가 명시적으로 동의(setOptedIn(true)) 한 경우에만 전송
// 2) 화이트리스트(ALLOWED_PROPS) 외 키는 자동 제거
// 3) 민감 키(BLOCKED_KEYS) 가 props 에 보이면 dev 콘솔 경고 + 제거
// 4) 명령 원문, 파일 내용, 자격 증명은 호출 측에서 절대 넣지 않음 (data-categories.md 강제)

import packageJson from "../../package.json";

const TELEMETRY_KEY = "tg.telemetry.optedIn";
const ANON_ID_KEY = "tg.anonId";
const BACKEND =
  (import.meta.env.VITE_TG_BACKEND as string | undefined) ??
  "https://api.terminalguardian.kr";

type EventName =
  | "tg.stage.entered"
  | "tg.tip.shown"
  | "tg.command.executed"
  | "tg.error.captured"
  | "tg.deploy.completed";

/**
 * docs/legal/data-categories.md 의 카탈로그를 코드로 옮긴 화이트리스트.
 * 새 키를 추가하려면 먼저 data-categories.md 를 갱신하고, 그 다음 여기.
 */
const ALLOWED_PROPS: Record<EventName, readonly string[]> = {
  "tg.stage.entered": ["stage", "os"],
  "tg.tip.shown": ["tipId", "priority"],
  "tg.command.executed": ["recipeId", "stepIndex", "outcome", "durationBucket"],
  "tg.error.captured": ["errorClass", "recipeId"],
  "tg.deploy.completed": ["target", "recipeId", "firstTime"],
};

/** 어떤 이벤트에서도 절대 들어와선 안 되는 키. 들어오면 dev 경고 + 제거. */
const BLOCKED_KEYS = new Set([
  "email",
  "name",
  "phone",
  "address",
  "ip",
  "mac",
  "deviceId",
  "serial",
  "command",
  "stdout",
  "stderr",
  "code",
  "prompt",
  "path",
  "filename",
  "cwd",
  "apiKey",
  "token",
  "password",
  "secret",
]);

export function isOptedIn(): boolean {
  return localStorage.getItem(TELEMETRY_KEY) === "1";
}

export function setOptedIn(value: boolean): void {
  localStorage.setItem(TELEMETRY_KEY, value ? "1" : "0");
}

/** 처리방침 §7 동의 철회 — 익명 ID 까지 회전시켜 과거 이벤트와의 연결을 끊음. */
export function rotateAnonId(): string {
  const id = crypto.randomUUID();
  localStorage.setItem(ANON_ID_KEY, id);
  return id;
}

function anonId(): string {
  let id = localStorage.getItem(ANON_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANON_ID_KEY, id);
  }
  return id;
}

export function getAnonId(): string | null {
  return localStorage.getItem(ANON_ID_KEY);
}

/**
 * 화이트리스트 외 키 제거 + 차단 키 검출.
 * 차단 키가 보이면 dev 빌드에선 콘솔 경고 (호출 측 버그 신호).
 */
function sanitizeProps(
  event: EventName,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const allowed = new Set(ALLOWED_PROPS[event]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (BLOCKED_KEYS.has(k)) {
      if (import.meta.env.DEV) {
        console.warn(
          `[telemetry] blocked key "${k}" passed to event "${event}". 호출 측을 수정하세요.`,
        );
      }
      continue;
    }
    if (!allowed.has(k)) {
      if (import.meta.env.DEV) {
        console.warn(
          `[telemetry] unknown key "${k}" for event "${event}". data-categories.md 갱신이 필요합니다.`,
        );
      }
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** 동의 안 했으면 조용히 무시. 실패도 무시. */
export function track(event: EventName, props: Record<string, unknown> = {}): void {
  if (!isOptedIn()) return;
  const safeProps = sanitizeProps(event, props);
  const body = JSON.stringify({
    event,
    anonId: anonId(),
    timestamp: new Date().toISOString(),
    appVersion: packageJson.version,
    props: safeProps,
  });
  void fetch(`${BACKEND}/telemetry`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    /* 텔레메트리 실패는 사용자 경험에 영향 X */
  });
}

/**
 * 정보주체 권리 §7 — 삭제권/철회권 행사.
 * 1) 옵트아웃, 2) 익명 ID 회전, 3) 백엔드에 과거 이벤트 삭제 요청.
 */
export async function requestDataDeletion(): Promise<{ ok: boolean }> {
  const oldId = getAnonId();
  setOptedIn(false);
  rotateAnonId();
  if (!oldId) return { ok: true };
  try {
    const res = await fetch(`${BACKEND}/telemetry/${encodeURIComponent(oldId)}`, {
      method: "DELETE",
      keepalive: true,
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

// 텔레메트리 — v0.9 §4.5 옵트인 원칙.
//
// 사용자가 명시적으로 동의한 경우에만 백엔드 /telemetry 로 전송.
// 개인 식별 정보 전송 금지 (디바이스 ID는 hash, 명령 원문 X).

import { APP_VERSION } from "./version";

const TELEMETRY_KEY = "tg.telemetry.optedIn";
const ANON_ID_KEY = "tg.anonId";
const BACKEND = (import.meta.env.VITE_TG_BACKEND as string | undefined) ?? "https://api.vibemate.kr";

type EventName =
  | "tg.stage.entered"
  | "tg.tip.shown"
  | "tg.command.executed"
  | "tg.error.captured"
  | "tg.deploy.completed";

export function isOptedIn(): boolean {
  return localStorage.getItem(TELEMETRY_KEY) === "1";
}

export function setOptedIn(value: boolean): void {
  localStorage.setItem(TELEMETRY_KEY, value ? "1" : "0");
}

function anonId(): string {
  let id = localStorage.getItem(ANON_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANON_ID_KEY, id);
  }
  return id;
}

/** 동의 안 했으면 조용히 무시. 실패도 무시. */
export function track(event: EventName, props: Record<string, unknown> = {}): void {
  if (!isOptedIn()) return;
  const body = JSON.stringify({
    event,
    anonId: anonId(),
    timestamp: new Date().toISOString(),
    appVersion: APP_VERSION,
    props,
  });
  // sendBeacon 은 페이지 unload 에도 안전하지만 데스크톱 앱에선 fetch 도 OK.
  void fetch(`${BACKEND}/telemetry`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    /* 텔레메트리 실패는 사용자 경험에 영향 X */
  });
}

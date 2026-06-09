// 코치 상태 파일 — 능동 어댑터(훅)와 HUD 사이의 로컬 채널. (node 전용)
//
// 훅이 한 턴의 조언(buckets)을 ~/.tg-coach/latest-turn.json 에 쓰고,
// 실행 중인 HUD(데스크톱 앱)가 그 파일을 폴링해 화면에 띄운다.
// MCP/원격으로 확장하기 전, 가장 단순하고 안전한 전송(파일 1개).

import { mkdirSync, writeFileSync, readFileSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { AdviceBucket } from "../core/types.ts";

/** 상태 파일 절대경로. Rust readFile 쪽도 같은 경로를 읽는다(~/.tg-coach/latest-turn.json). */
export function coachStatePath(): string {
  return join(homedir(), ".tg-coach", "latest-turn.json");
}

/** 한 턴 코칭의 단계. facts=훅이 즉시(사실), enriched=세션 AI가 맥락으로 덧칠(격려·아이디어). */
export type CoachPhase = "facts" | "enriched";

export interface CoachState {
  updatedAt: string;
  source: string; // 어느 어댑터가 썼나 (claude-code / cursor / claude-desktop)
  buckets: AdviceBucket[];
  phase?: CoachPhase;
  locale?: string;
}

export interface WriteOpts {
  phase?: CoachPhase;
  locale?: string;
}

/** 같은 턴 안에서 facts 가 enriched 를 덮지 않게 하는 시간 창(ms). turnId 계약 전까지의 휴리스틱. */
const SAME_TURN_MS = 60_000;

function readState(p: string): CoachState | null {
  try {
    return JSON.parse(readFileSync(p, "utf8")) as CoachState;
  } catch {
    return null;
  }
}

/**
 * 조언 buckets 를 상태 파일에 원자적으로 기록(temp→rename). 실패해도 흐름을 막지 않는다.
 * race 가드: 같은 턴 창(SAME_TURN_MS) 안에서 facts 쓰기는 이미 있는 enriched 를 덮지 않는다.
 *   (훅이 턴 끝에 facts 로 enriched 를 지우는 사고 방지. turnId 계약 전까지 시간 창 휴리스틱.)
 */
export function writeCoachState(buckets: AdviceBucket[], source: string, opts: WriteOpts = {}): void {
  try {
    const p = coachStatePath();
    mkdirSync(dirname(p), { recursive: true });

    const phase = opts.phase ?? "facts";
    if (phase === "facts") {
      const prev = readState(p);
      if (
        prev?.phase === "enriched" &&
        Date.now() - Date.parse(prev.updatedAt) < SAME_TURN_MS
      ) {
        return; // 최근 enriched 를 facts 로 강등하지 않는다
      }
    }

    const state: CoachState = {
      updatedAt: new Date().toISOString(),
      source,
      buckets,
      phase,
      ...(opts.locale ? { locale: opts.locale } : {}),
    };
    const tmp = `${p}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
    renameSync(tmp, p); // 원자적 교체 — HUD 가 반쯤 쓴 파일을 읽지 않게
  } catch {
    /* 권한·디스크 문제로 못 써도 코칭 자체(systemMessage)는 그대로 나간다 */
  }
}

/** 상태 파일 폐기(코치 끄기 시). writeCoachState 의 대칭. 없으면 조용히 통과. */
export function deleteCoachState(): void {
  try {
    rmSync(coachStatePath(), { force: true });
  } catch {
    /* 못 지워도 무해 — stale 표시는 updatedAt 으로 HUD 가 거른다 */
  }
}

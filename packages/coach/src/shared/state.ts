// 코치 상태 파일 — 능동 어댑터(훅)와 HUD 사이의 로컬 채널. (node 전용)
//
// 훅이 한 턴의 조언(buckets)을 ~/.tg-coach/latest-turn.json 에 쓰고,
// 실행 중인 HUD(데스크톱 앱)가 그 파일을 폴링해 화면에 띄운다.
// MCP/원격으로 확장하기 전, 가장 단순하고 안전한 전송(파일 1개).

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { AdviceBucket } from "../core/types.ts";

/** 상태 파일 절대경로. Rust readFile 쪽도 같은 경로를 읽는다(~/.tg-coach/latest-turn.json). */
export function coachStatePath(): string {
  return join(homedir(), ".tg-coach", "latest-turn.json");
}

export interface CoachState {
  updatedAt: string;
  source: string; // 어느 어댑터가 썼나 (claude-code / cursor)
  buckets: AdviceBucket[];
}

/** 조언 buckets 를 상태 파일에 기록. 실패해도 훅 흐름을 막지 않는다(조용히 무시). */
export function writeCoachState(buckets: AdviceBucket[], source: string): void {
  try {
    const p = coachStatePath();
    mkdirSync(dirname(p), { recursive: true });
    const state: CoachState = {
      updatedAt: new Date().toISOString(),
      source,
      buckets,
    };
    writeFileSync(p, JSON.stringify(state, null, 2), "utf8");
  } catch {
    /* 권한·디스크 문제로 못 써도 코칭 자체(systemMessage)는 그대로 나간다 */
  }
}

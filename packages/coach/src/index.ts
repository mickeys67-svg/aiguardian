// @tg/coach — 개발 턴 사이 조언 엔진.
// AI를 자동으로 떠밀지 않고, 턴이 끝나면 입문자에게 코칭만 준다. (스탠스: 자동 X, 조언 O)
//
// 구조 (ADR-0004):
//   core/                 클라이언트 독립 조언 엔진 (TurnSummary → 조언)
//   adapters/claude-code/ Claude Code transcript → TurnSummary 어댑터 + Stop 훅
//   (이후 adapters/cursor/ 등 추가)

export * from "./core/index.ts";
export {
  summarizeLastTurn,
  parseTranscript,
  extractUserCommands,
} from "./adapters/claude-code/transcript.ts";

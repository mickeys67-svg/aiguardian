// TG MCP 서버 — Week 4 본격 구현.
//
// 노출할 tool (v0.9 §4.2 모듈 #3 + Recipe Engine):
// - tg.scan          : 환경 진단 결과 반환
// - tg.run_command   : Safety Net 통과한 명령 실행
// - tg.deploy        : 레시피 배포 트리거
//
// Week 1 시점에는 인터페이스만.

export interface TgMcpToolNames {
  scan: "tg.scan";
  run_command: "tg.run_command";
  deploy: "tg.deploy";
}

export const TOOL_NAMES = {
  scan: "tg.scan",
  run_command: "tg.run_command",
  deploy: "tg.deploy",
} as const;

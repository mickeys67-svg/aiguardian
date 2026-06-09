// TG MCP 서버 — Claude Desktop · Claude Code · Cursor 가 TG 에 접근하는 다리.
//
// stdio 트랜스포트로 동작. Tauri 데스크톱 앱은 별도 프로세스이며,
// 이 서버는 node 단독으로 실행되어 클라이언트의 prompt → tool call 을 받는다.
//
// 노출 도구:
// - tg_scan : 환경 진단 (read-only). 앱이 명령을 대신 실행하지 않는다(ADR-0004) →
//             옛 tg_run_command·tg_deploy 는 제거됨.

export { runServer } from "./server.js";
export const TOOL_NAMES = {
  scan: "tg_scan",
} as const;

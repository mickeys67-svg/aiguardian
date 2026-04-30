// TG MCP 서버 — Claude Desktop · Claude Code · Cursor 가 TG 에 접근하는 다리.
//
// stdio 트랜스포트로 동작. Tauri 데스크톱 앱은 별도 프로세스이며,
// 이 서버는 node 단독으로 실행되어 클라이언트의 prompt → tool call 을 받는다.
//
// 노출 도구:
// - tg.scan          : 환경 진단 결과 (캐시된 SQLite 읽기)
// - tg.run_command   : Safety Net 통과한 명령 실행
// - tg.deploy        : Cloudflare Pages 배포

export { runServer } from "./server.js";
export const TOOL_NAMES = {
  scan: "tg_scan",
  runCommand: "tg_run_command",
  deploy: "tg_deploy",
} as const;

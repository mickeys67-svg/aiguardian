// 코어 계약(contract) — 클라이언트 독립.
//
// 어떤 AI 클라이언트(Claude Code·Cursor·Windsurf…)든, 그 클라의 "어댑터"가
// 자기 transcript/이벤트를 이 TurnSummary 한 가지 모양으로 정규화해 코어에 넘긴다.
// 코어는 클라가 무엇인지 전혀 모른 채 조언을 만든다. (ADR-0004: 단일 코어 + 어댑터)

export interface FileChange {
  path: string;
  /** create = 새로 만듦, edit = 고침 */
  action: "create" | "edit";
}

export interface CommandRun {
  command: string;
  failed: boolean;
}

/** 한 개발 턴에 무슨 일이 있었나 — 모든 어댑터가 채워 넘기는 정규화 입력. */
export interface TurnSummary {
  /** 사용자가 이 턴을 시작하며 넣은 프롬프트 */
  userPrompt: string;
  /** AI가 이 턴에 만들거나 고친 파일 */
  filesChanged: FileChange[];
  /** AI가 이 턴에 대신 실행한 명령 */
  commandsRun: CommandRun[];
  /** AI가 "당신이 직접 실행하세요"라고 안내한 명령 */
  userMustRun: string[];
  /** 이 턴에 에러가 한 번이라도 있었나 */
  hadError: boolean;
}

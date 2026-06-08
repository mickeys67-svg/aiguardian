# @tg/coach — 개발 턴 사이 조언 엔진 (프로토타입)

바이브코딩 입문자가 Claude Code로 개발할 때, **한 턴(프롬프트 → AI 개발)이 끝나는 순간**
"방금 무슨 일이 있었고, 당신이 직접 뭘 해야 하는지"를 코칭한다.

## 스탠스 (절대 원칙)

- **자동이 아니라 조언이다.** AI를 더 굴려 코드를 왕창 만드는 게 아니다.
- 조언은 `Stop` 훅의 **`systemMessage`(사용자에게만 표시)** 로 나간다.
  AI 컨텍스트로 가는 **`additionalContext`/`decision:block` 은 쓰지 않는다** —
  이게 "코치"와 "자동화 머신"을 가르는 선이다.
- 내용 없는 버킷은 만들지 않는다(가짜 채움 금지).

## 5버킷 조언

1. 📦 **무슨 일이 일어났어요** — 만든 파일·실행한 명령을 사람 말로 요약
2. 👀 **지금 확인해 보세요** — 에러 여부, 파일 확인, 화면 확인
3. ⌨️ **직접 하셔야 하는 작업** — AI가 시킨 터미널 명령 + 어느 셸/폴더에서
4. 💡 **초보자가 자주 놓쳐요** — 저장·커밋·node_modules 등
5. ➡️ **다음엔 이렇게** — 다음 프롬프트 방향 제안

## 바로 보기 (데모)

```bash
node src/adapters/claude-code/stop-hook.ts --demo   # 샘플 transcript 로 조언 출력
# 또는
pnpm --filter @tg/coach demo
```

## Claude Code 훅으로 연결

`~/.claude/settings.json` (또는 프로젝트 `.claude/settings.json`):

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "node /절대경로/packages/coach/src/adapters/claude-code/stop-hook.ts" }
        ]
      }
    ]
  }
}
```

훅은 stdin 으로 `{ transcript_path, ... }` 를 받아 transcript 를 분석하고,
`{ "systemMessage": "...조언..." }` 를 stdout 으로 돌려준다.

> ⚠️ **프로토타입 한계**
> - `systemMessage` 필드명/표시 방식은 설치된 Claude Code 버전의 훅 출력 스키마와 한 번 대조 필요.
> - transcript JSONL 형식은 방어적으로 파싱하지만(문자열/배열 content 모두 처리),
>   실제 세션 파일로 한 번 검증 권장.
> - "사용자가 직접 칠 명령" 추출은 휴리스틱(코드펜스 + 인라인 백틱)이라 보강 여지 있음.
> - 정식화 시: `@tg/tip-engine`(우선순위 큐)으로 조언 랭킹, backend `error_patterns`
>   테이블로 에러 번역 연결, hooks/MCP/skills 담은 Claude Code 플러그인으로 배포.

## 두 가지 조언 모드 (ADR-0004)

- **능동(turn-between)** = Claude Code `Stop` 훅 어댑터. 턴이 끝나면 자동으로 코칭. 훅 되는 클라(Claude Code·Cursor·Windsurf)만.
- **수동(on-demand)** = MCP 도구 `coach_review`. 모델/사용자가 부르면 코칭. **훅 없는 전 클라**(Claude Desktop·Cline·Copilot·Continue…)의 통로.

둘은 **입력 출처만 다르고 같은 코어**를 쓴다.

### 수동 코치 MCP 연결 (전 클라이언트)

```bash
node src/adapters/mcp/server.ts --demo   # 샘플 입력으로 코칭 출력
pnpm --filter @tg/coach demo:mcp
```

MCP 클라이언트 설정(예: `~/.cursor/mcp.json`, Claude Desktop config)의 `mcpServers`에:
```json
{ "tg-coach": { "command": "node", "args": ["/절대경로/packages/coach/src/adapters/mcp/server.ts"] } }
```
모델이 한 턴을 끝낸 뒤 `coach_review`를 "방금 한 일"과 함께 호출하면, 사람에게 보여줄 코칭 마크다운을 돌려준다.

## 구조 (단일 코어 + 클라별 어댑터)

```
src/core/                    클라이언트 독립 코어
  types.ts                   TurnSummary (모든 어댑터가 채우는 정규화 입력)
  advice.ts                  TurnSummary → 5버킷 조언 (존댓말, 빈 버킷 생략)
  render.ts                  조언 → 터미널 텍스트 / 마크다운
  index.ts                   adviseOnTurn / adviseOnTurnMarkdown
src/shared/
  transcript.ts              Anthropic식 content-block JSONL 파서 (CC·Cursor 공용)
src/adapters/claude-code/    능동 어댑터 — 출력: systemMessage
  stop-hook.ts               Stop 훅 진입점 (stdin JSON / --demo)
src/adapters/cursor/         능동 어댑터 — 출력: user_message (베타)
  stop-hook.ts               stop/afterAgentResponse 훅 진입점 (--demo)
src/adapters/mcp/            수동 어댑터 — 전 클라 호환
  coach-review.ts            느슨한 입력 → TurnSummary → 마크다운
  server.ts                  stdio MCP 서버 (coach_review 도구 / --demo)
test/sample-transcript.jsonl 데모용 샘플 턴
```

새 클라이언트 지원 = `src/adapters/<client>/` 추가(코어·파서는 그대로). 출력 필드만 클라별로 다름:
Claude Code `systemMessage` · Cursor `user_message`. **AI에게 가는 필드(additionalContext·agent_message·followup_message)는 금지** — `pnpm stance-lint` 가 차단.

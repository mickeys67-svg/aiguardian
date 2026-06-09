# 데스크탑 Claude 에서 코치 쓰기

> 데스크탑 Claude 는 Stop 훅이 없다. 그래서 자동 발화 대신 **MCP 확장(`coach_review`)**으로 코칭한다.
> 본진(자동·정밀·사람전용)은 Claude Code(CLI)·Cursor, 데스크탑은 **훅 없는 클라용 경로**다.

## 설치 (한 번만)

**입문자**: 릴리스 자산에서 `tg-coach.mcpb` 를 받아(릴리스 워크플로가 자동 첨부) →
데스크탑 Claude **설정 → 확장(Extensions)** → 파일 열기 → 설치. 끝.
> Node.js 는 데스크탑 Claude(mac/win)에 동봉돼 있어 **따로 설치할 필요 없다**.

**개발자**(소스에서 직접 만들기):
```bash
pnpm --filter @tg/coach build      # 자립형 .mjs 번들
pnpm --filter @tg/coach pack:mcpb  # dist/mcpb-stage 조립
npx @anthropic-ai/mcpb pack packages/coach/dist/mcpb-stage packages/coach/dist/tg-coach.mcpb
```

## 쓰는 법

데스크탑엔 "턴 끝" 훅이 없으므로 **사용자가 신호**를 준다:

- AI 와 한 작업이 끝나면 한마디: **"방금 한 거 코치가 짚어줘"**
- 그러면 모델이 `coach_review` 를 불러 → 무슨 일/확인할 것/직접 할 일/놓친 것/다음 방향을 한국어로 보여준다.
- 동시에 VibeMate 앱 HUD 가 **🟢 라이브 · claude-desktop** 으로 켜진다(같은 코칭을 카드로).

## Claude Code(CLI) 와 뭐가 다른가

| | Claude Code (훅) | 데스크탑 Claude (MCP) |
| --- | --- | --- |
| 발화 | 매 턴 자동 | 사용자가 "코치 봐줘" |
| 데이터 | 실제 transcript | 모델 자기보고(정확도 낮음) |
| 코칭 노출 | 사람 터미널만(`systemMessage`) | 채팅에 도구 결과로 **AI 컨텍스트에도 보임** |
| 앱 HUD | 🟢 라이브 · claude-code | 🟢 라이브 · claude-desktop |

## 알아둘 한 가지 (스탠스 타협)

데스크탑 경로는 코칭이 **AI 응답으로 돌아온다**(훅의 사람-전용 채널이 없음). 도구 설명에
"이걸 근거로 코드를 더 만들지 말 것"이라 못 박아두지만 소프트 가드다. 그래서 데스크탑에선
**HUD(앱 카드)를 주 코칭 화면으로** 보는 걸 권장한다 — AI 채팅 안의 코칭은 참고용.

# 코치 자호출 실측 런북 — enriched 가 실제로 떠지는지 측정

코치의 enriched 2박자(맞춤 격려·아이디어)는 세션 AI가 `coach_review`(MCP)를 **자호출**해야 채워진다.
이건 자동 보장이 아니라 모델의 자율 행동에 달려 있어, **출시 전 자호출률을 1회 실측**해 enriched 가
실제로 얼마나 떠지는지 확인하는 게 게이트다.

> 참고: 한때 훅이 `decision:block`으로 세션을 깨워 자호출을 강제하는 **부스터**를 옵트인으로 넣었으나,
> 7축 품질 감사에서 **ADR-0004 스탠스 위반(AI 떠밀기)**으로 판정돼 **코드에서 제거**했다.
> (`decision:block`의 reason 이 AI에 주입됨 + `stop_hook_active` 미문서화로 무한루프 위험.)
> 따라서 이 런북의 현재 목적은 '부스터 켜기'가 아니라 **자호출률 측정**이다.
> 2단계(부스터 왕복 검증)는 부스터를 다시 도입할 때만 의미가 있다 — 아래에 참고로 남긴다.

## 1단계 — 읽기전용 캡처 (무위험)

`stop_hook_active`가 입력에 실제로 오는지, 일반 턴에서 값이 무엇인지 확인한다. 이 단계는
`decision:block`을 절대 내지 않으므로 루프 위험이 0이다.

1. 코치를 켠다(앱의 "코치 켜기" 또는 dev 시 `localStorage["tg.coach.scriptPath"]`).
2. Claude Code 세션 환경변수에 `TG_COACH_CAPTURE=1`을 설정한다. (부스터는 **켜지 않는다**.)
3. 평소처럼 몇 개 턴을 진행한다(파일을 만들거나 고치는 잘된 턴 포함).
4. 캡처 로그를 확인한다: `~/.tg-coach/hook-capture.jsonl`
   - 각 줄이 훅이 받은 **원본 입력 JSON**이다.
   - 확인할 것: `stop_hook_active` 키가 존재하는가? 일반 턴에서 값은 `false`인가?

5. 자호출률 측정: 캡처 로그의 훅 발화 횟수 대비, HUD 상태(`~/.tg-coach/latest-turn.json`)가
   `phase: "enriched"`로 바뀐 비율을 세면 — '세션 AI가 실제로 coach_review를 자호출한 비율'이다.
   이 비율이 낮으면 enriched 는 사실상 잘 안 떠지는 것 → 제품 카피/온보딩에서 정직히 강등 표기.

`stop_hook_active` 데이터는 향후 부스터 재도입을 검토할 때의 안전 판단 근거로 보관한다.

## 2단계 — (참고) 부스터 왕복 검증 — 부스터를 다시 도입할 때만

> 현재 부스터 코드는 제거돼 있다. 아래는 향후 부스터를 재도입할 경우의 검증 절차 참고용이며,
> 재도입하려면 먼저 `decision:block`의 스탠스 모순(ADR-0004)을 해소해야 한다.

`stop_hook_active`가 존재함을 확인했으면, 부스터가 **딱 한 번만** block 하는지 검증한다.

1. `TG_COACH_CAPTURE=1`은 유지하고, `TG_COACH_BOOSTER=1`을 추가한다(부스터 재도입 후).
2. **잘된 턴 한 번**(에러 없이 파일/명령 작업)을 진행한다.
3. 기대 동작:
   - 1차 발화: 훅이 `decision:block`을 한 번 낸다 → 모델이 같은 세션에서 다시 깨어나 `coach_review`를 호출.
   - 2차 발화(재호출): 캡처 로그의 다음 줄에 `stop_hook_active: true`가 찍혀야 하고, 훅은 가드로
     **다시 block 하지 않고** 종료한다.
4. 캡처 로그가 **정확히 이 패턴**(첫 줄 `stop_hook_active` 없음/false → 다음 줄 `true`)이면 가드 안전.

만약 2차 줄에 `stop_hook_active: true`가 **찍히지 않으면** → 즉시 `TG_COACH_BOOSTER`를 끈다.
가드가 동작하지 않는 것이므로 부스터를 출시하면 안 된다.

## 3단계 — 켜기 결정

- 1·2단계를 통과해야만 부스터를 기본 활성으로 승격할지 검토한다(현재는 env opt-in 유지가 안전).
- 켤 때 `server.ts`의 `coach_review` 발화율(facts→enriched 전환율)을 함께 보면, 부스터가 실제로
  자호출률을 끌어올리는지 정량 확인할 수 있다.

## 관련 코드
- 부스터·캡처·루프가드: `packages/coach/src/adapters/claude-code/stop-hook.ts` (`decideStopOutput`)
- enriched 신호: `packages/coach/src/shared/state.ts` (`hasRecentEnriched`)
- 결정 로직 테스트: `packages/coach/test/coach.test.ts` (부스터 6종)
- 배경·제약: `docs/decisions/adr-0004-coach-architecture.md` (보강 2026-06-09)

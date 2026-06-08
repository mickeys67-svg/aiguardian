# 코치 동반자 — 진행 상황 (2026-06-09)

> 바이브코딩 입문자 옆에서 흐름을 짚어주는 코치. 자동 실행이 아니라 코칭.
> 결정 근거: [ADR-0004](decisions/adr-0004-coach-architecture.md)

## ✅ 한 일 (전부 main 에 머지됨)

| PR | 내용 |
| --- | --- |
| #2 | `@tg/coach` 코어+어댑터(Claude Code·Cursor·MCP) + HUD + 가드레일 + 테스트 |
| #3 | Rust CI `cargo fmt` 적색 해소 |
| #4 | "코치 켜기" 원클릭 설치 버튼 |
| #5 | 코치를 앱 첫 화면으로(온보딩 게이트 제거) |

핵심 구조:
```
@tg/coach
├─ core/      구조화 5버킷 조언 엔진(존댓말·OS인자·브라우저 호환)
├─ shared/    Anthropic식 transcript 파서 + 상태파일(라이브 채널)
├─ adapters/  claude-code(systemMessage) · cursor(user_message) · mcp(coach_review)
└─ install/   settings.json Stop 훅 넣고/빼는 순수 로직(테스트됨)

apps/desktop/src/app/coach/  HUD(여정맵·5버킷·복사버튼) + CoachConnect(코치 켜기)
scripts/  stance-lint · mock-scan (회귀 차단)
```
검증: 코치 테스트 17/17, 코어·데스크톱 타입체크, vite 빌드, stance-lint 17/mock-scan 70.

## 📍 현재 상태

- main = `09f0a0c`. 코드는 다 올라가 있음. **앱 릴리스는 아직 안 함**(vibemate.kr 다운로드는 옛 v0.2.6).
- "코치 켜기" 버튼은 **보이지만 dev 에선 회색** — 훅이 가리킬 stop-hook 스크립트가 **앱에 번들 안 됨**.

## 🔜 내일 할 일 (우선순위)

1. **스크립트 번들링** ← 가장 중요. Tauri 리소스로 `stop-hook` 포함 → "코치 켜기"가 실제로 동작 → 릴리스 가능해짐.
   - `CoachConnect.tsx` 의 `resolveResource("coach/tg-coach-stop.mjs")` 가 가리키는 자리.
2. **코치 버전 릴리스** — 번들 끝나면 태그 push(`release.yml`)로 새 앱 게시.
3. **옛 마법사 은퇴** — `pnpm stance-lint` 가 잡는 app-as-executor 17건(installer `--silent`, recipes `run_shell`, Confirm `runRecipeStep` 등).
4. **Mac/Linux 빌드** — 현재 `/latest` 는 Windows(x64)만. Mac/Linux 다운로드 버튼 깨짐.
5. **데스크탑 Claude 지원** — `coach_review` 가 HUD 상태파일도 쓰게(훅 없는 Desktop 에서도 HUD 살아남) + `.mcpb` 패키징(설정→확장 클릭 설치).
6. **옛 문자열 정리** — `terminalguardian.kr`(9곳) → `vibemate.kr`, `beta@` 이메일.

## ▶️ 실행/확인 방법

```powershell
cd E:\aiguardian
git checkout main && git pull
pnpm install
pnpm --filter @tg/desktop tauri dev   # 앱이 바로 코치 화면으로 열림
```
- 데모(앱 없이): `pnpm --filter @tg/coach demo` (능동) / `demo:mcp` (수동)
- 테스트: `pnpm --filter @tg/coach test`
- 가드레일: `pnpm stance-lint` / `pnpm mock-scan`

dev 에서 "코치 켜기" 눌러보려면(임시) 앱 콘솔에서:
```js
localStorage.setItem("tg.coach.scriptPath",
  "E:/aiguardian/packages/coach/src/adapters/claude-code/stop-hook.ts")
```

## ⚠️ 주의

- 라이브 검증 완료: 실제 Claude Code transcript 로 파서·코칭 동작 확인함(샘플 아님).
- `~/.claude/settings.json` 직접 편집은 에이전트 권한상 차단됨 → 그래서 "코치 켜기" 버튼이 필요했음.
- 데스크탑 Claude 는 훅 없음 → 자동 코칭 불가, MCP(수동)만. 자동 코칭은 Claude Code/Cursor.

# 텔레메트리 데이터 카테고리 (Data Categories)

> 이 문서는 코드 진실(Source of Truth)입니다.
> `apps/desktop/src/lib/telemetry.ts` 의 `ALLOWED_PROPS` 화이트리스트는 이 문서에서 파생됩니다.
> 새 이벤트나 속성을 추가하려면 이 문서에 먼저 정의하고, 코드를 갱신하세요.

## 설계 원칙

1. **익명성** — 직접 식별자(이름, 이메일, IP, 디바이스 ID) 절대 수집 안 함
2. **화이트리스트** — 명시적으로 허용된 props 키만 전송 (코드에서 강제)
3. **명령·파일 내용 금지** — 사용자 입력 원문은 어떤 경우에도 props 에 포함하지 않음
4. **카디널리티 제한** — props 값은 enum 또는 short bucket(예: <1s, 1-5s, >5s) 으로 정규화
5. **사후 검증** — 백엔드 `/telemetry` 가 화이트리스트 외 키를 받으면 거부 (`docs/legal/data-categories.md` 참조)

## 이벤트 카탈로그

### `tg.stage.entered` — 온보딩 단계 진입

| 키 | 타입 | 허용 값 | 의미 |
|---|---|---|---|
| `stage` | enum | `welcome`, `inspect`, `install`, `connect`, `recipe`, `run`, `error`, `deploy`, `done` | 진입한 단계 |
| `os` | enum | `windows`, `macos`, `linux` | 운영체제 그룹 |

### `tg.tip.shown` — 팁 표시

| 키 | 타입 | 허용 값 | 의미 |
|---|---|---|---|
| `tipId` | string | 화이트리스트 ID 목록 (`packages/tip-engine`) | 표시된 팁 ID |
| `priority` | enum | `low`, `medium`, `high` | 팁 우선순위 |

### `tg.command.executed` — 안전 명령 실행 (원문 X)

| 키 | 타입 | 허용 값 | 의미 |
|---|---|---|---|
| `recipeId` | string | 레시피 카탈로그 ID | 실행 중인 레시피 |
| `stepIndex` | number | 0..N | 레시피 내 단계 번호 |
| `outcome` | enum | `success`, `user_cancelled`, `safety_blocked`, `error` | 결과 분류 |
| `durationBucket` | enum | `<1s`, `1-5s`, `5-30s`, `>30s` | 소요 시간 구간 |

**주의**: 명령어 원문, stdout/stderr, 파일 경로는 절대 포함하지 않습니다.

### `tg.error.captured` — 에러 분류 (원문 X)

| 키 | 타입 | 허용 값 | 의미 |
|---|---|---|---|
| `errorClass` | enum | `network`, `permission`, `not_found`, `safety_block`, `dependency`, `unknown` | 분류만 |
| `recipeId` | string | 카탈로그 ID 또는 `null` | 발생 위치 |

**주의**: 에러 메시지 원문, 스택 트레이스, 변수 값은 포함하지 않습니다.

### `tg.deploy.completed` — 첫 배포 완료

| 키 | 타입 | 허용 값 | 의미 |
|---|---|---|---|
| `target` | enum | `vercel`, `cloudflare_pages`, `netlify`, `github_pages`, `other` | 배포 대상 |
| `recipeId` | string | 카탈로그 ID | 사용한 레시피 |
| `firstTime` | boolean | `true`/`false` | 사용자의 첫 배포 여부 |

## 항상 동반되는 envelope 필드

모든 이벤트에 자동 부착되는 메타데이터 (코드에서 검증):

| 키 | 타입 | 의미 |
|---|---|---|
| `event` | enum | 위 이벤트 카탈로그의 키 중 하나 |
| `anonId` | UUID v4 | 설치별 임의 ID, localStorage 에 저장. 사용자가 앱 데이터 삭제 시 즉시 재생성 |
| `timestamp` | ISO 8601 UTC | 이벤트 발생 시각 |
| `appVersion` | semver | `package.json` / `Cargo.toml` 버전 |

## 명시적으로 수집하지 않는 항목

다음은 어떤 이벤트에서도 수집하지 않으며, 백엔드는 이런 키가 보이면 요청을 거부합니다:

- `email`, `name`, `phone`, `address` — 식별자
- `ip`, `mac`, `deviceId`, `serial` — 네트워크/하드웨어 식별자
- `command`, `stdout`, `stderr`, `code`, `prompt` — 사용자 입력/AI 응답 원문
- `path`, `filename`, `cwd` — 파일 시스템 경로
- `apiKey`, `token`, `password`, `secret` — 자격 증명

## 변경 절차

새 이벤트나 속성을 추가하려면:

1. 본 문서에 카탈로그 항목 추가
2. `apps/desktop/src/lib/telemetry.ts` 의 `ALLOWED_PROPS` 갱신
3. `services/backend/src/index.ts` 의 검증 함수 갱신
4. 처리방침 §2.1 표 업데이트 (필요 시)
5. 변경 이력에 기록 (아래)

## 변경 이력

| 일자 | 버전 | 변경 |
|---|---|---|
| 2026-05-03 | 0.1-draft | 초기 카탈로그 작성 |

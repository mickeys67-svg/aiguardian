# 정식 출시 직전 감사 보고서 — Vibemate v0.2.2

**작성일**: 2026-05-02
**범위**: 다운로드 → 설치 → 첫 실행 전체 사용자 흐름 + 코드 품질 + 인프라 정합성
**검증 방식**: 3개 에이전트 병렬 (UX 흐름·코드 감사·크로스체크) + 라이브 endpoint 검증

---

## 0. 한 줄 결론

```
출시 가능 여부:  ❌ NO-GO
차단 사유:       1건 (Critical) — Tauri Updater 자산 매처 불일치
                 v0.2.0/v0.2.1 → v0.2.2 자동 업데이트 영구 불가 + 향후 모든 업데이트 차단
픽스 시간:       2~3시간 (코드 1줄 + v0.2.3 재릴리스)
```

---

## 1. CRITICAL — 출시 전 반드시 수정 (1건)

### C-1. Tauri Updater 자산 매처 불일치 ★

**증상**:
```bash
$ curl https://tg-backend.mickeys67.workers.dev/updates/windows-x86_64/0.2.0
204 No Content   ← 업데이트 없음으로 응답

$ curl .../updates/darwin-aarch64/0.2.0
204 No Content
```
v0.2.2 가 발행됐고 prerelease=false 인데도 옛 사용자에게 자동 업데이트 안 옴.

**근본 원인** (`services/backend/src/github.ts:80-114`):
```ts
"windows-x86_64": (n) => n.endsWith(".nsis.zip"),    // ❌ 자산 없음
"darwin-aarch64": (n) => n.includes("aarch64") && ..., // ❌ universal 빌드라 매칭 0
"darwin-x86_64":  (n) => n.includes("x64") && ...,     // ❌ 동일
```

v0.2.2 실제 자산:
- `Vibemate_0.2.2_x64-setup.exe` — 매처 ❌ (.exe, not .nsis.zip)
- `Vibemate_0.2.2_x64_*.msi` — 매처 ❌
- `Vibemate_universal.app.tar.gz` — 매처 ❌ (no "aarch64"/"x64")

**픽스 — 옵션 A 추천 (가장 빠름)**:
`apps/desktop/src-tauri/tauri.conf.json:31` 의 endpoint 를 tauri-action 자동 생성 `latest.json` 으로 변경.
```json
"endpoints": [
  "https://github.com/mickeys67-svg/aiguardian/releases/latest/download/latest.json"
]
```
백엔드 `/updates/{target}/{current_version}` 라우트는 그대로 두되 안 쓰임. tauri-action 의 `latest.json` 이 모든 매칭 처리.

**픽스 — 옵션 B (스펙 일치)**:
`getMatchingBundle` 매처를 실제 자산명에 맞게 수정 + tauri-action 에 `bundles: app,nsis,msi,dmg` 명시.

**예상 작업 시간**: 옵션 A — 5분 (코드 1줄 변경) + 15분 (v0.2.3 빌드)

---

## 2. HIGH — 출시 직후 1주 내 반드시 수정 (5건)

### H-1. `api.vibemate.kr/latest` 503 — 운영 워커 GH 토큰 미설정

**증상**:
```bash
$ curl https://api.vibemate.kr/latest
503 {"error":"no release available", ...}

$ curl https://tg-backend.mickeys67.workers.dev/latest
200 {"version":"0.2.2", "assets":[...]}   ← 정상
```

→ 두 URL 이 같은 워커여야 하는데 응답 다름. GH_TOKEN secret 누락 또는 라우팅 문제.

**영향**: 랜딩이 `api.vibemate.kr/latest` 호출 → 503 → "곧 다운로드 가능" fallback 영구 표시. 첫 인상 깨짐.

**픽스**: 
```bash
wrangler secret put GH_TOKEN   # GitHub PAT (repo:read)
# 또는 api.vibemate.kr 가 다른 worker 로 잘못 매핑됐는지 확인
```

### H-2. OAuth Secrets 운영 환경 검증 미수행

**상태**: 코드는 정합. 단 운영 `api.vibemate.kr/auth/google` 라이브 검증 안 함.

**검증 명령**:
```bash
curl -i https://api.vibemate.kr/auth/google
# 302 → accounts.google.com    ← OK
# 500 google_client_id_missing  ← FAIL (secrets 누락)
```

**픽스** (실패 시): 대시보드 또는 `wrangler secret put GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `WEB_ORIGIN`.

### H-3. Mac 아키텍처 자동 감지 부정확

**위치**: `apps/landing/index.html:327-339` `detectPlatform()` + `services/backend/src/github.ts:81-100` `pickAsset`

**문제**: navigator.userAgent 만 보고 무조건 universal. universal 자산 없으면 임의 dmg fallback → M1 사용자가 Intel dmg 받을 위험.

**현재 v0.2.2 자산**: `Vibemate_universal.app.tar.gz` 만 있고 `.dmg` 가 보이지 않음 — 추가 검증 필요.

**픽스**: tauri-action 에 `--target universal-apple-darwin --target aarch64-apple-darwin --target x86_64-apple-darwin` 명시 + 랜딩에 명확한 OS 선택 UI.

### H-4. SmartScreen / AhnLab 안내 부재

**증상**: 본인 PC 에서 실제 발생 — V3 가 NSIS 인스톨러 침묵 차단 → 사용자 "어? 안 깔리네?" → 포기.

**위치**: `apps/landing/index.html` 다운로드 CTA 주변 0줄 안내.

**픽스**:
```html
<!-- CTA 아래 -->
<details>
  <summary>설치가 안 되시나요? (Windows · 한국 백신)</summary>
  <ul>
    <li><strong>SmartScreen 경고</strong>: "추가 정보" → "실행" 클릭</li>
    <li><strong>AhnLab V3 차단</strong>: MSI 버전 받기 → <a href="/download/win-msi">.msi</a></li>
    <li><strong>관리자 권한 필요</strong>: UAC 팝업 시 "예"</li>
  </ul>
</details>
```

추가로 `/download/win-msi` 라우트 신설 (현재는 `pickAsset` 이 자동으로 .exe 우선).

### H-5. 컴맹 페르소나 — 첫 화면 탈출률 위험

**5개 항목 (모두 HIGH/9점)**:

| # | 위치 | 문제 |
|---|---|---|
| 5-A | `Welcome.tsx:22-30` | "VIBE 코딩이 뭐?" 무응답 |
| 5-B | `Confirm.tsx:121` | 관리자 권한·UAC 사전 설명 0 |
| 5-C | `Confirm.tsx:220-228` | UI 한국어 + stderr 영문 혼재 |
| 5-D | `Result.tsx:84-90` | ⚠️ 가 위협으로 인식 |
| 5-E | `Confirm.tsx:175` → `Home.tsx:46` | 첫 레시피가 Home 에 안 잡힘 |

**픽스 패턴**: 
- 5-A: Welcome 에 "왜 만들었냐" 60자 설명 추가
- 5-C: stderr 패턴 매칭 (백엔드 `/error-patterns` 이미 있음) → Confirm 에서 한국어 카드 우선 노출
- 5-D: ⚠️ → ➕ ("이걸 깔아드릴게요" 라벨)

---

## 3. MEDIUM — 출시 후 2주 내 (8건)

### M-1. 버전 잔존 3곳

| 파일:라인 | 현재 값 | 정답 |
|---|---|---|
| `apps/desktop/src/lib/telemetry.ts:42` | `appVersion: "0.1.0"` (하드코드) | `appVersion: APP_VERSION` (import) |
| `services/backend/src/index.ts:69` | `/health` 응답 `version: "0.1.0"` | `"0.2.2"` 또는 환경변수 |
| `package.json:3` (root) | `"version": "0.1.0"` | `"0.2.2"` |

### M-2. D1 마이그레이션 0003 멱등성 부족

**위치**: `services/backend/migrations/0003_google_auth.sql`

**문제**: SQLite `ALTER TABLE ADD COLUMN` 은 `IF NOT EXISTS` 미지원 → 재실행 시 "duplicate column" 에러.

**픽스**: D1 migrations 도구가 이름 단위 추적하므로 현재는 OK이지만, 향후 Preview 환경 등에서 재실행 시 깨짐. 안전판으로 마이그레이션 분리 또는 try/catch 패턴.

### M-3. CORS Origin Fallback Wide-Open 위험

**위치**: `services/backend/src/index.ts:51-58`

**문제**: 화이트리스트 외 origin 에도 `https://vibemate.kr` 응답. `Origin: null` (모바일 WebView 등) 도 `vibemate.kr` 처럼 처리됨.

**픽스**: 외부 origin 은 명시 `null` 반환 → 브라우저 CORS 거부.

### M-4. PURGE_TOKEN timing-safe 비교 누락

**위치**: `services/backend/src/index.ts:311-323`

**문제**: `!==` short-circuit timing leak.

**픽스**: 길이 + XOR 합 또는 `crypto.subtle.timingSafeEqual`.

### M-5. Diagnosis 진행률 가짜 동기

**위치**: `apps/desktop/src/app/onboarding/Diagnosis.tsx:7-26`

**문제**: 600ms × 5 = 3초 진행률 표시, 실제 진단은 5~30초. 사용자 멈춘 줄 알고 종료.

**픽스**: Rust `inspect_environment` 가 Tauri event emit → 프론트가 실제 진행률 동기.

### M-6. 진단 에러 복구 경로 없음

**위치**: `apps/desktop/src/app/onboarding/Diagnosis.tsx:77-81`

**문제**: 에러 시 재시도/Skip 버튼 없음 → 사용자 영구 멈춤 → 강제 종료.

**픽스**: "다시 진단", "건너뛰고 메인으로", "도움 요청 (에러 복사)" 3개 버튼.

### M-7. Linux 빌드 부재

**위치**: `.github/workflows/release.yml:18-26`

**문제**: 매트릭스에 ubuntu 없음 → Linux .AppImage 자산 0 → `/download/linux` 항상 404 → 랜딩 `dl-linux` 죽은 링크.

**픽스**: 매트릭스 추가 또는 랜딩에서 Linux 링크 숨김 + "Linux 지원 준비 중" 표시.

### M-8. README · docs TG → Vibemate 정리

**위치**: 36+ 라인 (`README.md`, `docs/`, `scripts/`, `packages/`)

**문제**: 외부 노출 시 신뢰도 손상.

**픽스**: 일괄 sed 후 검토.

---

## 4. LOW — 출시 후 1개월 내 (5건)

| # | 위치 | 내용 |
|---|---|---|
| L-1 | `apps/desktop/src-tauri/Cargo.toml:11` | `authors = ["Seungho <seungho@tg>"]` — 도메인 잔재 |
| L-2 | `apps/desktop/package.json:1` | `@tg/desktop` npm 패키지명 (workspace 내부 참조 다수) |
| L-3 | `apps/landing/_headers:7` | CSP `'unsafe-inline'` 의존 — strict CSP 미적용 |
| L-4 | `apps/desktop/src-tauri/src/fileio/mod.rs:84-87` | UTF-8 가정. BOM 파일 깨짐 |
| L-5 | `apps/landing/index.html:419` | 텍스트 "TG는 그 모든 막힘을..." 잔존 |

---

## 5. 스파게티 패턴 / 충돌 가능성

### 5-1. 매처 중복 정의 ★
- `services/backend/src/github.ts:135-142` (`getMatchingBundle`)
- `services/backend/src/index.ts:251-262` (인라인 매칭)
- 두 곳에서 darwin-x86_64 매처 분기가 미묘하게 다름 → 정합성 위험.

### 5-2. localStorage 키 분산
8+ 곳에서 `tg.*` 키 정의 (`state.ts`, `cheatsheet.ts`, `iteration.ts`, `storageGc.ts`, `telemetry.ts`, ...). 매니페스트 부재로 GC 누락 위험.

### 5-3. landing init() 책임 6개
`apps/landing/index.html:544-572` 한 함수가 OAuth wiring + /me fetch + 분기 + downloads wiring + /latest fetch + 에러 swallow.

### 5-4. 빈 catch 블록 13곳
`/* ignore */` 패턴이 silent failure 유발 — 디버깅 시 어디서 끊겼는지 추적 불가.

### 5-5. v0.1 ↔ v0.2.0 ↔ v0.2.1 ↔ v0.2.2 동시 설치 가능성
- v0.1 / v0.2.0: `productName: "TG"`, `identifier: kr.tg.desktop`
- v0.2.1 / v0.2.2: `productName: "Vibemate"`, `identifier: kr.vibemate.desktop`
- 다른 identifier = 다른 ProductCode = **병존 가능**. 사용자 혼란 ("어느 게 진짜?").

**픽스**: 첫 부팅 시 옛 TG 발견 → "옛 버전 발견. 정리할까요?" 안내 모달.

---

## 6. 라이브 검증 결과 (방금 수행)

| 검증 | 결과 | 평가 |
|---|---|---|
| `https://vibemate.kr` | 200 OK + 보안헤더 6 | ✅ |
| `https://api.vibemate.kr/health` | 200 + 헤더 정상 | ✅ |
| `https://api.vibemate.kr/me` (비로그인) | 401 | ✅ |
| `https://api.vibemate.kr/auth/google` | 302 → google.com (client_id 정상) | ✅ |
| `https://api.vibemate.kr/download/win` (비로그인) | 302 → vibemate.kr/?login_required=1 | ✅ |
| `https://api.vibemate.kr/latest` | **503 no release** | ❌ H-1 |
| `https://tg-backend.mickeys67.workers.dev/latest` | 200 + v0.2.2 | ✅ |
| `https://...workers.dev/updates/windows-x86_64/0.2.0` | **204** (자산 매칭 실패) | ❌ C-1 |
| GitHub Releases v0.2.2 | 10 자산 (msi/dmg 포함) | ✅ |
| Worker secrets | 4개 등록 (GOOGLE_CLIENT_ID/SECRET/WEB_ORIGIN/PURGE_TOKEN) | ✅ |
| MSI 실제 설치 | 본인 PC 검증 완료 (kr.vibemate.desktop) | ✅ |
| 화면 윈도우 타이틀 | "TG" + "v0.1" — 잔존 텍스트 | ❌ v0.2.2 빌드로 해결됨 (재배포 진행중) |

---

## 7. 통합 우선순위 매트릭스

| 우선순위 | ID | 영역 | 차단 vs 후속 | 작업 시간 |
|---|---|---|---|---|
| **P0 (Critical)** | C-1 | Tauri Updater 매처 | **출시 전 차단** | 5분 코드 + 15분 빌드 |
| **P1 (High)** | H-1 | api.vibemate.kr GH_TOKEN | 출시 전 검증 + 픽스 | 5분 |
| **P1** | H-2 | OAuth secrets 검증 | 출시 전 검증 | 1분 |
| **P1** | H-3 | Mac arch 분기 | 출시 후 1주 | 30분 |
| **P1** | H-4 | SmartScreen·AhnLab 안내 | 출시 후 1주 | 1시간 |
| **P1** | H-5 | 컴맹 페르소나 5개 | 출시 후 1~2주 | 4~6시간 |
| **P2 (Medium)** | M-1 | 버전 잔존 3곳 | 출시 후 즉시 | 30분 |
| **P2** | M-2 | D1 0003 멱등성 | 출시 후 1주 | 30분 |
| **P2** | M-3 | CORS fallback | 출시 후 1주 | 15분 |
| **P2** | M-4 | PURGE_TOKEN timing-safe | 출시 후 1주 | 15분 |
| **P2** | M-5 | Diagnosis 진행률 | 출시 후 2주 | 2시간 |
| **P2** | M-6 | 진단 에러 복구 | 출시 후 2주 | 1시간 |
| **P2** | M-7 | Linux 빌드 | 출시 후 1개월 | 1시간 |
| **P2** | M-8 | README · docs | 출시 후 1주 | 1시간 |
| **P3 (Low)** | L-1~L-5 | 잔재·UTF-8·CSP | 출시 후 1개월+ | 누적 4시간 |

---

## 8. 권장 출시 절차

```
[즉시 — 30분 안]
1. tauri.conf.json:31 endpoint → releases/latest/download/latest.json
2. apps/desktop/src/lib/telemetry.ts:42 → APP_VERSION import
3. services/backend/src/index.ts:69 → "0.2.3"
4. wrangler secret put GH_TOKEN (api.vibemate.kr 워커)
5. curl https://api.vibemate.kr/auth/google 검증
6. curl https://api.vibemate.kr/latest 검증

[10분 — 빌드]
7. git commit + push + tag v0.2.3
8. GitHub Actions release.yml 빌드 대기

[검증 — 빌드 후 5분]
9. curl https://api.vibemate.kr/latest → v0.2.3
10. curl https://api.vibemate.kr/updates/windows-x86_64/0.2.0 → 200 + signature

[E2E — 30분]
11. 시크릿 창으로 vibemate.kr 접속
12. Google 로그인 → 환영 패널 노출 확인
13. 다운로드 → MSI 설치 → 화면 "Vibemate v0.2.3" 정상 표시
14. 더미 v0.2.4 발행 → 자동 업데이트 알림 확인 → updater 검증
```

위 14단계 모두 GREEN → **정식 출시 GO**.

---

## 9. 출시 후 1주 로드맵

```
Day 1 (오늘):
  - C-1, H-1, H-2, M-1 픽스 → v0.2.3 출시

Day 2~3:
  - H-4 (SmartScreen·AhnLab 안내) — 한국 사용자 이탈률 50% 개선 예상
  - M-5 (Diagnosis 진행률) — 가짜 진행률 → 실제 동기

Day 4~5:
  - H-5 (컴맹 페르소나) — Welcome 설명, stderr 한국어, ⚠️ → ➕
  - M-6 (진단 에러 복구)

Day 6~7:
  - M-3 (CORS), M-4 (timing-safe)
  - H-3 (Mac arch) — universal 강제 빌드
  - M-8 (README/docs)
  
Week 2:
  - M-7 (Linux), L-1~L-5 (잔재 정리)
  - 첫 사용자 피드백 기반 우선순위 재조정
```

---

## 10. 결론

**출시 전 반드시 (1건)**:
- **C-1**: Updater 매처 → tauri.conf.json endpoint 변경. 5분 작업.

**출시 전 검증 (2건)**:
- **H-1**: api.vibemate.kr/latest 503 → GH_TOKEN secret 확인.
- **H-2**: api.vibemate.kr/auth/google 라이브 동작 확인.

위 3건만 처리하면 정식 출시 가능. 나머지 21건은 출시 후 7~30일 로드맵.

핵심 발견은 **"코드는 거의 정합한데 단 1줄 (updater endpoint) 이 자동 업데이트 인프라를 죽이고 있다"** 입니다. 옵션 A 적용 후 v0.2.3 재릴리스 권장.

---

**부록 — 검증 스크립트** (출시 직전 본인 실행):
```bash
# 1. 인프라 health
curl -sf https://vibemate.kr | grep -q "Vibemate" && echo "✅ 랜딩"
curl -sf https://api.vibemate.kr/health | grep -q "ok" && echo "✅ 백엔드"
curl -sf https://api.vibemate.kr/latest | grep -q "0.2.3" && echo "✅ /latest"
curl -sI https://api.vibemate.kr/auth/google | grep -q "302" && echo "✅ OAuth"

# 2. 인증 게이트
curl -sI https://api.vibemate.kr/download/win | grep -q "login_required" && echo "✅ 다운로드 게이트"

# 3. 자동 업데이트 (옛 사용자 흐름)
curl -sf https://api.vibemate.kr/updates/windows-x86_64/0.2.0 | grep -q "version" && echo "✅ Updater"

# 4. 보안 헤더
curl -sI https://vibemate.kr | grep -qi "strict-transport" && echo "✅ HSTS"
```

위 6개 모두 ✅ 면 출시 GO.

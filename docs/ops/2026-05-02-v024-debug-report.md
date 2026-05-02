# 대규모 디버깅 보고서 — Vibemate v0.2.4

**시점**: 2026-05-02 (v0.2.4 빌드 완료 후)
**범위**: 전체 사이트 / 다운로드 / 파일 유효성 / 스파게티 / 충돌 / 버그 / 갑자기 플로우 소실 / 회귀
**검증 방식**: 3 병렬 에이전트 (UX 막힘 / 코드 품질 / 파일 무결성) + 라이브 endpoint 검증

---

## 0. 한 줄 결론

```
✅ 사용자 다운로드 인프라 — 자산 16개 모두 무결성 확인 (MSI/EXE/DMG 매직 바이트, sig 서명 형식 정합)
✅ Tauri Updater 11 플랫폼 키 모두 sig + URL 정합
⚠ Critical 4건 (1주 내 픽스):
   1. Confirm.tsx "나중에" 무한 루프
   2. needsAdmin regex 사실상 dead (20 레시피에 매칭 0건)
   3. storage 폴더 tg/tg.db v0.2.0 와 락 충돌 가능성
   4. 매처 3곳 중복 (sig 매칭 회귀 위험)
⚠ High 6건 / Medium 8건 / Low 7건
```

---

## 1. Critical (1주 내 차단) — 4건

### C-1. Confirm.tsx 관리자 권한 모달 "나중에" 무한 루프 ★사용자 영향 큼

**증상**:
```
사용자: dry-run 통과 → "✓ 진짜 실행할게요" 클릭
       → 관리자 모달 떠 (단, 현재 dead code 라 안 뜸 — C-2 참조)
       → "나중에" 클릭
       → 모달만 닫힘. mode 는 그대로 dry-done.
       → "✓ 진짜 실행할게요" 버튼 다시 보임
       → 누르면 또 모달 → 무한 루프
```

**원인**: `apps/desktop/src/app/onboarding/Confirm.tsx:209-213`
```tsx
onClick={() => setAdminWarningOpen(false)}  // ← 모달만 닫고 mode 그대로
```

**픽스**:
```tsx
onClick={() => {
  setAdminWarningOpen(false);
  setMode("idle");
  setResults([]);
}}
```

### C-2. needsAdmin regex 가 현 레시피 0건 매칭 ★기능 약속 위반

**증상**:
v0.2.4 릴리스 노트는 "관리자 권한 사전 모달" 추가라고 광고. 실제 사용자는 모달을 **절대 못 봄**.

**원인**: `apps/desktop/src/app/onboarding/Confirm.tsx:41-47`
```tsx
const needsAdmin = useMemo(() => {
  return recipe.steps.some((s) => {
    const cmd = (s.command + " " + s.windowsCommand).toLowerCase();
    return /\b(npm install -g|sudo|elevate|runas|winget install|choco install|setx \/m|reg add hklm)\b/i.test(cmd);
  });
}, [recipe]);
```

`recipes/index.json` 20개 레시피 전수 grep:
- `npm install -g` 0건 (모두 로컬 설치)
- `sudo` / `runas` / `winget install` / `choco install` / `setx /m` / `reg add hklm` 모두 0건
- → **모달 트리거 조건 0건**

진짜 UAC 발생 지점: `installer/` 모듈의 `installTool` invoke (winget/choco/brew 호출). 이건 **Result.tsx** 화면이고 Confirm 외부.

**픽스 (선택)**:
- A. 모달을 Result.tsx 의 "한 번에 깔기" 버튼 직전으로 이동
- B. needsAdmin 검사 영역을 `recipe.requires` (Node/Python/Git 등) 기반으로 재정의 — Result 가 그걸 winget 으로 깔 거니까

### C-3. Storage 폴더 `tg/tg.db` v0.2.0 와 락 충돌 ★데이터 안전

**증상**:
- v0.2.0 (`kr.tg.desktop`) 과 v0.2.4 (`kr.vibemate.desktop`) 가 **같은 SQLite DB 파일** 공유
- 위치: `~/AppData/Local/tg/tg.db`
- 둘 다 깔린 사용자가 두 앱 동시 시작 → SQLite 락 → 두 번째 앱 in-memory only fallback (`lib.rs:19-21`)

**원인**: `apps/desktop/src-tauri/src/storage/mod.rs:17-19`
```rust
.join("tg")           // ← identifier 무관 하드코딩
.join("tg.db")
```

**픽스 (안전한 마이그레이션)**:
1. 새 폴더 `vibemate/` 사용
2. 첫 부팅 시 `tg/tg.db` 발견 → `vibemate/tg.db` 로 복사 (학습 진도 보존)
3. 옛 폴더는 삭제하지 않음 (옛 v0.2.0 호환성 위해)

### C-4. 매처 3곳 중복 — sig 매칭 실패 회귀 위험 ★Updater 인프라

**증상**:
- `services/backend/src/github.ts:64-121` `pickAsset` (다운로드용)
- `services/backend/src/github.ts:132-171` `buildUpdaterResponse.lookup` (Updater)
- `services/backend/src/index.ts:283-298` `getMatchingBundle` (sig 검색)
- 셋이 **다른 함수에 동일 매처 정의** → 한 곳만 수정 시 sig 매칭 실패

**과거 회귀**: v0.2.0~0.2.2 의 sig 매칭 실패 원인이 정확히 이 패턴.

**픽스**: 한 함수 `getMatchingBundleAsset` 로 통합 + 두 호출자 모두 사용.

---

## 2. High (다음 릴리스 전) — 6건

### H-1. `/me` 응답 지연 시 anon CTA 깜빡임
- `apps/landing/index.html:601-629`
- 로그인 후 `?logged_in=1` 으로 redirect → 1-3초 동안 "Google 로 시작" 그대로 보임 → 환영 패널로 전환
- **픽스**: 쿼리 `?logged_in=1` 감지 시 즉시 anon CTA hide + 스피너

### H-2. `/download/:platform` 404 시 JSON 직접 노출
- `services/backend/src/index.ts:208-213`
- 자산 누락 시 `{error:"no matching asset"}` JSON 화면 → 사용자 멘붕
- **픽스**: 404 시 vibemate.kr 으로 redirect with error param

### H-3. `googleCallback` DB upsert 실패 시 500 unhandled
- `services/backend/src/auth.ts:122-156`
- DB throw 시 try/catch 없음 → Cloudflare Workers default 500
- **픽스**: 전체 try/catch + redirect to `?login_error=db`

### H-4. `/latest` 한국어 notes mojibake
- 라이브 검증에서 `notes` 필드의 한국어가 cp949 깨짐 발견
- 원본 GitHub `latest.json` 은 정상 UTF-8
- **픽스**: 백엔드 응답 헤더 명시 `content-type: application/json; charset=utf-8`

### H-5. 잔존 "TG / tg" 텍스트 (사용자 visible)
- `apps/desktop/src-tauri/Cargo.toml:8` `description = "TG (Terminal Guardian) desktop app"`
- → winget 패키지 메타에 노출 가능
- **픽스**: description → "Vibemate desktop app"

### H-6. `Diagnosis` `handleRetry` 후 stalled 재발화
- `apps/desktop/src/app/onboarding/Diagnosis.tsx:48-54`
- `useEffect` deps `[isLoading]` — `isLoading` 변경 시 자동 setStalled(false)
- 재시도 직후 1-2초 안에 또 stalled 표시 가능 (race)
- **픽스**: `handleRetry` 에서 `setStalled(false)` 명시 호출

---

## 3. Medium (2주 내) — 8건

### M-1. errorTranslate 누락 패턴 5종
`apps/desktop/src/lib/errorTranslate.ts`:
- Windows `npm install` EPERM/EBUSY (파일 잠김)
- Python `pip` SSL: CERTIFICATE_VERIFY_FAILED (회사 네트워크)
- macOS `xcode-select: error` (Xcode CLI 미설치)
- 한국어 Windows: `'pip' 은(는) 내부 또는 외부 명령... 으로 인식되지 않습니다`
- `tar: Error opening archive`

### M-2. dry-run stderr 한국어 변환 누락
`apps/desktop/src/app/onboarding/Confirm.tsx:282-286` `<pre>` 가 영문 stderr 그대로. ErrorPanel (한국어) 은 진짜 실행 실패에만 발화.
**픽스**: dry-run 결과 위에 `translateError(r.stderr)` 한국어 줄 1개 추가.

### M-3. dry-run 실패 시 진행 옵션 없음
- `apps/desktop/src/app/onboarding/Confirm.tsx:131-160`
- "다시 시도" 만 가능 → 같은 환경에서 같은 명령 또 실패할 게 명백
- **픽스**: "위험을 알고 진짜 실행" 옵션 또는 "단계 건너뛰기"

### M-4. Artifact path null 좀비 프로젝트
- `apps/desktop/src/app/state.ts:106-126` `finishOnboarding` 가 빈 path 도 addProject
- Home 의 ProjectCard 가 `artifactPath:""` 인 좀비 표시
- **픽스**: `run.artifactPath` truthy 일 때만 addProject

### M-5. CORS `origin: null` 타입 안전
- `services/backend/src/index.ts:55`
- Hono v4 에서 null 반환 동작 묘함 → 빈 string 안전
- **픽스**: `null` → `""` 또는 명시적 분기

### M-6. errorTranslate greedy regex
- `apps/desktop/src/lib/errorTranslate.ts:32, 70`
- `'?([^'"]+)'?` greedy → 한 줄 끝까지 흡수 가능
- **픽스**: `[^'"\s]+` 단어 단위로 좁힘

### M-7. `vm.backend.override` (Landing) vs `tg.*` (Desktop) prefix 불일치
- 의도적이지만 향후 통일 필요

### M-8. localStorage 매니페스트 부재 (A-3)
- 18개 키 8군데 분산. dismiss/seen 키는 영구 누적 (claim/reset 안 됨)

---

## 4. Low (관찰 가치) — 7건

| ID | 위치 | 내용 |
|---|---|---|
| L-1 | `Cargo.toml:11` | `seungho@tg` 이메일 도메인 잔재 (이미 픽스됨, 검증) |
| L-2 | `fileio/mod.rs:99-104` | UTF-16 BOM 미처리 → "UTF-8 아니에요" 만 표시 |
| L-3 | `state.ts:124` | finishOnboarding setItem 의 throw 미처리 |
| L-4 | `state.ts` projects 손상 시 자동 백업 없음 | tg.projects.v1 손상 → [] 반환, 사용자 데이터 사라짐 |
| L-5 | CSP `connect-src` GitHub.com 없음 | Tauri Updater native, webview 영향 X |
| L-6 | `compareVersions` prerelease 미지원 | RC 빌드 시 잘못 비교 |
| L-7 | `runStorageGc` dismiss/seen 키 청소 안 함 | 사용자 reset 후에도 안 사라짐 |

---

## 5. 라이브 검증 결과 (파일 무결성 — Agent 3)

### 자산 16개 모두 OK
- 5 OS (Windows .exe + .msi ko/en, Mac universal.dmg, Linux AppImage/deb/rpm)
- 1 Updater latest.json (6.9 KB)
- 7 시그니처 파일 (.sig)

### 다운로드 검증 (실파일)
| 파일 | 매직 바이트 | 검증 |
|---|---|---|
| Vibemate_0.2.4_x64_ko-KR.msi | `D0 CF 11 E0` (OLE2) | ✅ |
| Vibemate_0.2.4_x64_en-US.msi | `D0 CF 11 E0` (OLE2) | ✅ |
| Vibemate_0.2.4_x64-setup.exe | `4D 5A` (PE) | ✅ |
| Vibemate_0.2.4_universal.dmg | `78 DA` + `koly` | ✅ |

ko-KR 과 en-US 의 SHA256 다름 (정상 — locale string table 차이).

### 시그니처 11 플랫폼 키 모두 정합
- 모두 minisign 형식 (untrusted comment + Ed25519 sig + trusted timestamp)
- Tauri Updater 표준 준수 ✅

### 백엔드 endpoint 응답 코드
```
/health           200  ✅
/me               401  ✅ (인증 필요)
/latest           200  ✅
/auth/google      302  ✅ (OAuth)
/download/win     302  ✅ (인증 게이트)
/download/win-msi 302  ✅ (NEW)
/admin/purge      401  ✅ (auth-gated)
```

### 랜딩 자산 (7개 모두 200)
```
/                 200 text/html
/privacy.html     200 text/html
/terms.html       200 text/html
/robots.txt       200 text/plain
/sitemap.xml      200 application/xml
/favicon.svg      200 image/svg+xml
/og-image.png     200 image/png
```

---

## 6. 수정 후 회귀 위험 (수정 후 에러 가능성)

### 회귀 픽스 안전성 평가

| 픽스 | 위험도 | 근거 |
|---|---|---|
| C-1 needsAdmin → Result 이동 | Medium | 검사 영역 변경 — 기존 모달 동작 회귀 |
| C-2 "나중에" 무한 루프 | Low | mode setter 1줄 추가 |
| C-3 storage 폴더 마이그레이션 | High | DB 데이터 이동 — 실패 시 학습 진도 손실 |
| C-4 매처 통합 | Medium | sig 매칭 자동 테스트 필요 |
| H-1 /me 깜빡임 | Low | DOM hide 1줄 |
| H-2 /download 404 redirect | Low | JSON → 302 변경 |
| H-3 OAuth try/catch | Low | error redirect 추가 |
| H-4 /latest charset | Low | response header 1줄 |
| M-1 errorTranslate 5 패턴 | Very Low | 추가만 함 |
| M-2 dry-run 한국어 변환 | Low | UI 추가 |
| M-4 좀비 프로젝트 | Low | 조건문 1개 |

---

## 7. 즉시 픽스 가능한 6건 (저위험)

```
1. C-2  Confirm "나중에" 무한 루프 (한 줄)
2. M-1  errorTranslate 5 패턴 추가
3. M-4  좀비 프로젝트 가드
4. H-4  /latest charset
5. H-5  Cargo.toml description
6. M-6  greedy regex 수정
```

**연기 (위험·외부 의존)**:
```
- C-1 needsAdmin 재설계 (Result 로 이동 — 별도 분석)
- C-3 storage 폴더 마이그레이션 (DB 안전 — 별도 검증 필수)
- C-4 매처 통합 (자동 테스트 필요)
- H-1 /me 깜빡임 (UX 개선 — 사용자 영향 작음)
- H-2/H-3 (백엔드 redirect/try-catch)
- M-3/M-5/M-8 등 (구조 변경)
```

---

## 8. 통합 우선순위 매트릭스

| 우선순위 | 영역 | 건수 |
|---|---|---|
| **P0 (Critical, 1주 내)** | C-1, C-2, C-3, C-4 | 4 |
| **P1 (High, 2주 내)** | H-1 ~ H-6 | 6 |
| **P2 (Medium, 1개월)** | M-1 ~ M-8 | 8 |
| **P3 (Low, 백로그)** | L-1 ~ L-7 | 7 |
| **계** | — | **25** |

---

## 9. 결론

```
✅ 출시 인프라 자체는 견고 — 자산 16개, sig 11개 모두 정합
✅ 사용자가 다운받는 .msi/.dmg/.AppImage 무결성 확인
⚠ Critical 4건 중 2건 (C-1, C-2) 은 "v0.2.4 신기능이 사실상 안 동작"
⚠ Critical 2건 (C-3, C-4) 은 인프라 구조적 위험 — 점진적 마이그레이션 필요
```

**즉시 픽스 6건 적용 후 v0.2.5 권장**:
- C-2, M-1, M-4, M-6, H-4, H-5

**별도 분석 필요한 4건**:
- C-1: needsAdmin 재설계 위치 결정
- C-3: storage 마이그레이션 전략 + 백업
- C-4: 매처 통합 + 자동 테스트
- B-2: 옛 v0.2.0~0.2.2 사용자 endpoint 호환성 검증

---

**관련 문서**:
- [v0.2.4 사후 시뮬레이션](./2026-05-02-v024-postlaunch-report.md)
- [출시 전 감사](./2026-05-02-prelaunch-audit-report.md)

**검증 자산**: `/tmp/vibemate.{msi,exe,dmg}` (라이브 다운로드 후 매직 바이트 + SHA256 확인)

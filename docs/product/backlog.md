# 백로그 — 베타 결과 + 자체 사용 경험에서 발견된 입문자 자동화 항목

> v0.9 + 자체 dogfooding 으로 식별된 "입문자가 막히는 지점" 모음. v1.0 ~ v2.0 스코프.

## v1.0 우선

### B-001 GitHub 연결 자동화 (Stage 8)
**문제**: 사용자가 첫 코드를 인터넷에 띄우려면 `gh auth login` (8자리 코드 + 브라우저 인증), Personal Access Token 발급, SSH 키 생성 등 진입장벽 높음. 본인(개발자) 도 막히는 지점.

**해결**:
- TG 안에 "GitHub 연결" 모듈 추가
- 첫 클릭 시 device flow OAuth 자동 시작 (사용자는 브라우저에서 코드 한 번만 입력)
- token 은 OS keychain (Windows Credential Manager / macOS Keychain) 안전 저장
- 이후 `gh` 명령 자동 호출 (push, secret set, release create 등)
- 실패 시 한국어 에러 + 재시도

**관련 파일 (예정)**:
- `apps/desktop/src-tauri/src/github/mod.rs` — Octocrab 또는 직접 REST + device flow
- `apps/desktop/src/app/sections/Github.tsx` — 연결 UI

### B-002 Cloudflare 연결 자동화 (Stage 8)
**문제**: `wrangler login` 도 OAuth 흐름 + custom domain · D1 · KV 셋업이 모두 따로.

**해결**: TG 안에서 Cloudflare API token 발급 → workspace 자동 셋업.

### B-003 Tauri 시그니처 키 자동 생성 + 백업 (Stage 9 졸업 전 단계)
**문제**: minisign 키 비번 두 번 입력, 분실 시 Updater 영구 불가.

**해결**: TG 가 dev 모드에서 키를 자동 생성, OS keychain 백업, 비번 자동 관리.

## v2.0

### B-004 Stage 6 실행 화면 — 코드 붙여넣기 textarea
**문제**: AI 에게 받은 HTML/JS 를 어디에 저장할지 모름. 현재 `cat > file` 우회는 stdin 대기 문제.

**해결**:
- Recipe step type `write_file` 추가 (이미 fileio 커맨드 있음, UI 미연결)
- Confirm 다음 단계에서 monaco editor / textarea + "여기 붙여넣고 저장" 버튼
- TG 가 알아서 적절한 파일명 (index.html / app.py) 으로 저장

### B-005 한국어 에러 패턴 자동 학습
**문제**: `ErrorPanel` 의 `FRIENDLY_TRANSLATIONS` 가 hardcoded. 새로운 에러 종류 만나면 fallback 메시지.

**해결**:
- 백엔드 `/error-patterns` 가 사용자 에러 빈도 기반 자동 큐레이션
- Top 200 에러 패턴 + 한국어 해결 가이드 D1 시드
- 입문자가 같은 에러 두 번째 만나면 즉시 해결

### B-006 졸업 모드 (Stage 9 v0.9 §2.2)
**문제**: 사용자가 자기효능감 ↑ 한 후에도 가디언에 의존.

**해결**: `learned_term` 임계값 도달 시 가디언 도움말 자동 비활성, 졸업 배지 발급.

## 자체 dogfooding 메모

| 일자 | 발견 | 영향 |
| --- | --- | --- |
| 2026-04-30 | `ghkrdls`, `wotlwkr` 등 한영 키 입력 오타 자주 발생 | 입력 폼에 한영 자동 감지·교정? (low priority) |
| 2026-04-30 | gh auth login dialog 옵션 4개 어려움 | B-001 |
| 2026-04-30 | Tauri signer 비번 두 번 입력 mismatch 빈번 | B-003 |
| 2026-04-30 | `cat > file` Windows cmd 가 stdin 대기로 멈춤 | B-004 |
| 2026-04-30 | wrangler subdomain 빈 문자열 입력 시 무한 재질문 | 사용자 경험 ↓, mention only |

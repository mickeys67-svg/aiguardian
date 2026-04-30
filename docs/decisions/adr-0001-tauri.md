# ADR-0001: 데스크톱 앱 셸로 Tauri 2.0 채택

- 상태: Accepted
- 날짜: 2026-04-30
- 결정자: @seungho

## 맥락

TG는 Mac과 Windows 양쪽에서 동일한 입문자 경험을 제공해야 한다. 데스크톱 앱 셸 후보는 Tauri 2.0, Electron, Flutter Desktop, .NET MAUI 4가지가 있다. 입문자 도구의 특성상 다음 제약이 강하다:

1. **다운로드 크기** — "또 어려운 거 아냐?" 진입 부담을 낮추기 위해 인스톨러는 가능한 한 작아야 한다 (v0.9 §1.2 참조).
2. **시스템 명령 실행 안전성** — System Inspector·Tool Installer가 사용자 시스템에 깊이 접근하므로 native 보안성이 중요하다 (v0.9 §4.5).
3. **단일 코드베이스** — 외주 없이 본인 + Claude 페어로 6개월에 v1.0까지 가야 한다. OS별 분기 비용은 최소화.
4. **MCP 통합** — TypeScript SDK를 그대로 쓸 수 있어야 한다.

## 결정

**Tauri 2.0**을 데스크톱 앱 셸로 채택한다. 프론트엔드는 React 18 + TypeScript + Tailwind + shadcn/ui, 코어 로직은 Rust(tokio).

## 대안

### Electron (탈락)
- 장점: 압도적 생태계, Node 그대로, 학습 곡선 낮음.
- 단점: 인스톨러 100MB+ (Chromium 동봉), 메모리 사용 ↑, 입문자에게 "왜 이렇게 무거워?" 인상.
- v0.9 §4.3에서 이미 "Electron 대비 1/10 용량"을 가치 명제로 적시.

### Flutter Desktop (탈락)
- 장점: 단일 코드, 디자인 자유도 높음.
- 단점: Dart 학습 비용 + Rust 코어와 통합 복잡, MCP TS SDK를 다시 래핑해야 함, 데스크톱 패키징 생태계 미성숙.

### .NET MAUI (탈락)
- 장점: Windows 친화.
- 단점: Mac 지원 제한적, C# 생태계로 가면 입문자 레시피(주로 Python/JS) 통합 비용 ↑.

## 결과

### 좋은 점
- 인스톨러 ~15MB → 다운로드 부담 최소
- Rust 코어로 시스템 명령 실행이 type-safe + 메모리 안전
- React + shadcn/ui로 v0.9 §3.5 디자인 시스템 즉시 구현 가능
- pnpm + Cargo 단일 모노레포 가능

### 나쁜 점 / 트레이드오프
- Tauri 2.0은 v1 대비 변화가 크고 일부 플러그인 생태계가 아직 얇음 → 필요 시 직접 구현 또는 v1 호환 모드 사용
- Mac WebView (WKWebView)와 Windows WebView2 간 미세한 렌더링 차이 → CSS 레벨 정규화 필요
- Rust 학습 비용 → Claude 페어로 상쇄, 표준 패턴(`tauri::command`, `tokio::spawn`) 위주로 사용

### 후속 액션
- Week 1: `pnpm create tauri-app` 후 React+TS+Tailwind 템플릿 적용
- Week 5 (Win 어댑터 진입 시): WebView2 차이점 회귀 테스트 추가
- v1.0 전: Tauri 보안 가이드 재검토, `tauri.conf.json` allowlist 최소화 검증

# ADR-0002: Win 우선 개발 + Mac CI/클라우드 검증 전략

- 상태: Accepted (Supersedes v0.9 §5.2 "Mac 우선" 부분)
- 날짜: 2026-04-30
- 결정자: @seungho

## 맥락

ADR-0001에서 Tauri 2.0을 채택했고, v0.9 개발계획서 §5.2는 "Mac 우선 → Win 포팅"을 가정했다. 그러나 실제 개발 환경에는 Mac 머신이 없다. 다음 세 가지 사실이 결정을 뒤집는다.

1. **현재 v0.1 코드는 OS-중립이다.** `inspector`, `installer`, `mcp`, `recipes` 모듈 모두 `cfg!(target_os = "...")` 분기로 양 OS를 동등하게 처리한다. winget 매핑·Win Claude Desktop 경로·`cmd /C` 셸 분기 모두 이미 들어있다.
2. **한국 데스크톱 시장 비중**은 Win 70%+, Mac 20% 안팎. 베타 100명을 Win-only로 모아도 v0.9 §7.1 KPI(70% 첫 코드 30분 내 실행)를 측정하기에 충분하다.
3. **Mac 컴파일 회귀는 GitHub Actions `macos-latest` 러너로 무료 검증** 가능하다. 실기 GUI 테스트는 베타 직전 1회만 필요하므로, 클라우드 Mac 임대(MacInCloud ~$30/월) 또는 지인 머신을 단기 대여로 충분하다.

## 결정

**개발 우선순위와 베타 모집을 Win-first로 뒤집고**, Mac은 다음 두 채널로만 검증한다.

1. **CI 채널**: 모든 PR + main push에서 GitHub Actions가 `windows-latest` + `macos-latest` 양쪽에 `cargo check + clippy + test`를 자동 실행. 컴파일/타입 회귀는 즉시 잡힘.
2. **실기 채널**: Week 5~6 베타 직전 1회. 클라우드 Mac 또는 지인 머신에서 v0.9 §3.6 5분 온보딩 시나리오 1회 실행. 발견되는 결함만 핫픽스.

베타 100명 분포는 **Win 80 + Mac 20**으로 조정. Mac 20명에는 GitHub Actions에서 빌드된 unsigned dmg를 배포 (Notarization은 Apple Developer 가입 후 별도 일정).

## 대안

### Mac 머신 구매 (탈락)
- 장점: 즉시 GUI 테스트 가능.
- 단점: ~$1,500+ 즉시 지출, 본인+Claude 페어 모델의 압축 예산(1,510만 원)에서 초과. 베타 시그널 없이 자본 투입.

### MacStadium / AWS EC2 mac1 인스턴스 (보류)
- 장점: 클라우드 Mac, 강력.
- 단점: 시간당 $1+ 또는 24시간 lease ($30+). v0.1 단계엔 과투자. 필요해지면 그때 결정.

### 베타를 v1.0으로 미루고 v0.1을 Win-only 알파로 (탈락)
- 장점: 일정 단순화.
- 단점: v0.9 §7.1 MVP 성공 기준(베타 100명) 미달. 외부 시그널 없이 v1.0 진입 → 리스크 ↑.

## 결과

### 좋은 점
- 사용자가 보유한 Win 머신에서 즉시 `pnpm tauri dev` 가능 → Week 1~5 잔여 작업 없이 바로 Week 6 진입 가능
- Mac 머신 구매 비용 절감
- Win 사용자(자영업자 페르소나 박철호, 마케팅 페르소나 김영희)가 베타 다수 → 한국 시장 검증 가속
- ADR-0001의 Tauri 2.0 단일 코드베이스 가치를 실제로 활용

### 나쁜 점 / 트레이드오프
- 디자이너 페르소나 최지원(Mac 보유 경향)의 베타 비중 ↓ → 디자인 자유도 페르소나 시그널은 v1.0 후 보강 필요
- Mac unsigned 빌드는 Gatekeeper 경고가 뜸 → 베타 사용자에게 "마우스 우클릭 → 열기" 안내 필요
- 클라우드 Mac 비용은 베타 직전 일회성으로 발생 (~$30~50)

### 후속 액션 (즉시)
- `release.yml`에 `windows-latest` 활성화, `macos-latest`는 unsigned로 유지
- `ci.yml`에 `windows-latest` + `macos-latest` 양쪽 cargo job 추가
- `tauri.conf.json`에 Windows 번들 (msi + nsis) 설정
- `docs/dev-setup-windows.md` 작성 (rustup + MSVC build tools + WebView2)
- `scripts/bootstrap.ps1` 작성 (winget으로 prerequisite 일괄 설치)
- Mac 클라우드 lease는 Week 5 종료 시점에 결정 (MacInCloud 1주 vs MacStadium 시간당)
- 베타 모집 카피 분리 (Win 메인 + Mac 베타 별도)

## 영향 받는 v0.9 항목
- **§5.2 Week 5**: "Win 어댑터 시작" → "Mac CI 통합 + 클라우드 Mac lease 결정"
- **§5.2 Week 6**: "Win 베타 빌드 + 코드 서명" → "Win MSI 서명 (EV Cert) + Mac unsigned dmg + 베타 모집 (Win 80 + Mac 20)"
- **§7.1 v0.1 KPI**: MAU 100 베타 분포 명시 (Win 80 + Mac 20)
- **§7.2 예산**: Mac Notarization $99/년 → Week 6 후로 이연. 클라우드 Mac ~$30~50 1회성 추가

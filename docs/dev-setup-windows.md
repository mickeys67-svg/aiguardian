# Windows 개발 환경 셋업

> Win 우선 결정 (ADR-0002) 따라, 본 문서가 1차 개발 가이드.

## 한 줄 자동 셋업 (권장)

PowerShell **관리자 권한**으로 실행:

```powershell
cd E:\aiguardian
.\scripts\bootstrap.ps1
```

이 스크립트는 winget으로 다음을 일괄 설치:
- Rustlang.Rustup (Rust toolchain)
- OpenJS.NodeJS.LTS (Node 20+, 이미 설치돼 있어도 무해)
- Microsoft.VisualStudio.2022.BuildTools (Tauri Rust 컴파일에 필요한 MSVC)
- Microsoft.EdgeWebView2 (Tauri 런타임)

설치 후 새 PowerShell 창을 열어 PATH 갱신. `pnpm install` → `pnpm dev`.

---

## 수동 셋업 (자동 스크립트가 막힐 때)

### 1. Rust toolchain

```powershell
winget install --id Rustlang.Rustup -e
# 또는 https://rustup.rs 에서 rustup-init.exe 다운로드
```

설치 후 새 PowerShell 창에서:

```powershell
rustup default stable
rustc --version  # rustc 1.77+ 가 출력돼야 함
cargo --version
```

### 2. Visual Studio Build Tools (MSVC)

Tauri는 Windows에서 MSVC 링커를 사용한다. 가벼운 옵션:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

### 3. WebView2 런타임

Windows 11에는 기본 설치돼 있다. Win 10이면:

```powershell
winget install --id Microsoft.EdgeWebView2 -e
```

### 4. Node + pnpm

Node 20+ 와 pnpm 9+ 가 필요. 이미 설치돼 있는지 확인:

```powershell
node --version  # v20+ 필요
pnpm --version  # 9+ 필요
```

없으면:

```powershell
winget install --id OpenJS.NodeJS.LTS -e
npm install -g pnpm@9
```

---

## 첫 부팅 검증

```powershell
cd E:\aiguardian
pnpm install
pnpm --filter @tg/desktop tauri dev
```

다음 순서대로 동작해야 함:

1. Vite 개발 서버 1420번 포트에 부팅
2. cargo 가 src-tauri 의존성 컴파일 (첫 회 5~10분)
3. TG 창이 떠서 Welcome 화면 표시
4. "시작할게요" 클릭 → Diagnosis (스캔 30초) → Result 카드 그리드

만약 멈추면 [트러블슈팅](#트러블슈팅) 섹션 참조.

---

## 빌드 (개인 검증용 MSI)

```powershell
cd E:\aiguardian
pnpm --filter @tg/desktop tauri build
```

산출물:
- `apps/desktop/src-tauri/target/release/bundle/msi/TG_0.1.0_x64_en-US.msi`
- `apps/desktop/src-tauri/target/release/bundle/nsis/TG_0.1.0_x64-setup.exe`

⚠️ EV Cert 미발급 상태에서는 Windows SmartScreen 이 "Microsoft Defender SmartScreen이 인식할 수 없는 앱의 시작을 차단했습니다" 경고를 띄움. 베타 사용자에게 "추가 정보 → 실행" 안내 필요. Week 6 EV Cert 발급 후 해소.

---

## Mac 검증 (이 PC에서는 불가, ADR-0002)

- **CI 회귀**: GitHub Actions 의 `macos-latest` 러너가 main push마다 cargo check/clippy/test 실행. 컴파일 회귀는 PR 단계에서 잡힘.
- **실기 테스트**: Week 5~6 베타 직전 1회. 후보:
  - MacInCloud — 월 ~$30, 브라우저 RDP
  - 지인 Mac 단기 대여 (1~2시간)
  - AWS EC2 mac1.metal — 24시간 lease ~$30, 강력하지만 셋업 비용 ↑

CI 가 통과하는 한, "내 PC에서만 동작" 리스크는 사실상 0. 실기는 GUI 픽셀·notarization·드물게 macOS 권한 다이얼로그 검증용.

---

## 트러블슈팅

### `error: linker 'link.exe' not found`
MSVC Build Tools 미설치. 위 [2번 단계](#2-visual-studio-build-tools-msvc) 참조.

### `error: failed to run custom build command for 'webview2-com-sys'`
WebView2 SDK 누락. 보통 MSVC Build Tools 와 같이 깔리지만 안 되면:
```powershell
winget install --id Microsoft.EdgeWebView2 -e
```
재부팅 후 `cargo clean && pnpm dev`.

### `pnpm install` 이 매우 느림
처음에는 ~300MB 다운. `--prefer-offline` 추가하면 다음부터 빠름.

### Windows Defender 가 cargo 빌드 산출물을 격리
Windows Defender 의 "폴더 액세스 제어"가 켜져 있으면 cargo target 디렉토리가 차단될 수 있음.
- 일시 해결: `Add-MpPreference -ExclusionPath "E:\aiguardian\apps\desktop\src-tauri\target"`

### Vite 가 `EADDRINUSE: 1420 in use`
다른 dev 서버가 떠 있음. 종료하거나 Tauri config 의 `devUrl` 포트 변경.

---

## 참고

- Tauri 2.0 Windows prerequisite: https://v2.tauri.app/start/prerequisites/#windows
- rustup-init: https://rustup.rs
- pnpm 설치: https://pnpm.io/installation

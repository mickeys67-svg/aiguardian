# Vibemate

> 바이브코딩 입문자를 위한 통합 가디언 — 컴퓨터 켠 첫 순간부터 첫 앱 배포까지 끊김 없이 안내.
> https://vibemate.kr · admin@vibemate.kr

원본 전략 문서: [docs/product/v0.9-original.md](docs/product/v0.9-original.md)
실행 계획서: `C:\Users\micke\.claude\plans\c-users-micke-downloads-terminal-guardi-fancy-fiddle.md`

## 모노레포 구조

```
apps/desktop          Tauri 2.0 데스크톱 앱 (React + TS + Rust)
packages/mcp-server   AI 클라이언트 연결용 MCP 서버
packages/recipe-schema 레시피 JSON 스키마 + 검증
packages/ui           공유 디자인 시스템 (shadcn/ui 기반)
packages/tip-engine   팁 인젝션 우선순위 큐
services/backend      Cloudflare Workers + D1 + R2 (Hono)
recipes/              레시피 메타·스크립트
docs/                 제품 문서 + ADR
scripts/              개발 환경 부트스트랩
```

## 첫 시작 (Windows 우선 — ADR-0002)

### 1) 개발 환경
```powershell
# 관리자 PowerShell에서 한 번만:
cd E:\aiguardian
.\scripts\bootstrap.ps1            # rustup + MSVC + WebView2 + Node 자동 설치

# 새 PowerShell 창에서:
pnpm install
pnpm --filter @tg/desktop tauri dev   # 첫 빌드 5~10분
```

### 2) 서버 + 다운로드 페이지 배포
```powershell
# wrangler 로그인 (한 번만)
pnpm exec wrangler login

# Cloudflare D1 + KV + Workers + Pages + GitHub repo 일괄 셋업
.\scripts\deploy-all.ps1 -GhOwner <github-username> -Domain vibemate.kr
```

### 3) 첫 배포·다운로드 테스트
```powershell
git tag v0.1.0
git push origin v0.1.0
# GitHub Actions 가 Win + Mac 빌드 → release → 백엔드 캐시 퍼지
```

자세한 가이드: [docs/dev-setup-windows.md](docs/dev-setup-windows.md), [docs/smoke-test.md](docs/smoke-test.md)

Mac은 GitHub Actions(macos-latest)에서 cargo CI만 돌고, 실기 GUI 테스트는 Week 5~6 베타 직전 1회 클라우드 Mac/지인 머신으로 검증 ([ADR-0002](docs/decisions/adr-0002-windows-first.md)).

## 결정 사항 (2026-04-30)

| 항목 | 값 | ADR |
| --- | --- | --- |
| 앱 셸 | Tauri 2.0 + React + TS + Rust | [0001](docs/decisions/adr-0001-tauri.md) |
| OS 우선 | **Win 우선 → Mac은 CI + 클라우드 검증** | [0002](docs/decisions/adr-0002-windows-first.md) |
| 1차 AI | Claude Desktop + Claude Code + Cursor | — |
| 인력 | 본인 + Claude(코딩 파트너) | — |
| 브랜드 | 가코드명 `TG` → Week 4~5 확정 | — |

## 6주 MVP 마일스톤 (조정됨)

| Week | 산출물 | 상태 |
| --- | --- | --- |
| 1 | 모노레포 + Tauri 보일러플레이트 | ✅ |
| 2 | System Inspector + 온보딩 3화면 | ✅ |
| 3 | Tool Installer + Safety Net 기초 | ✅ |
| 4 | MCP Integrator 3종 + 첫 레시피 E2E | ✅ |
| 5 | 팁 시스템 + 에러 화면 + Mac CI 연결 + 클라우드 Mac 결정 | 🟡 (코드 ✅, Mac CI ✅, 클라우드 lease 보류) |
| 6 | Win MSI + Mac unsigned dmg + 베타 (Win 80 + Mac 20) | ⬜ |

## 라이선스

현재 클로즈드. v1.0 전 오픈소스 범위 결정 (ADR-0003 예정).

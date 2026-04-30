# TG (Terminal Guardian, 가칭)

> 바이브코딩 입문자를 위한 통합 가디언 — 컴퓨터 켠 첫 순간부터 첫 앱 배포까지 끊김 없이 안내.

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
```

## 개발 시작

```bash
# 의존성 설치 (pnpm 9 + Rust 1.77+ 필요)
pnpm install

# 데스크톱 앱 개발 모드 (Mac 우선)
pnpm dev

# 프로덕션 빌드
pnpm build
```

## 결정 사항 (2026-04-30)

- **OS**: Mac 우선 → Win 포팅 (Week 5~)
- **AI 클라이언트 1차**: Claude Desktop + Claude Code + Cursor
- **인력**: 본인 + Claude(코딩 파트너)
- **브랜드**: 가코드명 `TG` → Week 4~5 확정

자세한 내용은 [docs/decisions/](docs/decisions/) 의 ADR 참조.

## 6주 MVP 마일스톤

| Week | 산출물 |
| --- | --- |
| 1 | 모노레포 + Tauri "Hello TG" Mac 빌드 |
| 2 | System Inspector + 온보딩 3화면 |
| 3 | Tool Installer + Safety Net 기초 |
| 4 | MCP Integrator 3종 + 첫 레시피 E2E |
| 5 | 팁 시스템 + UX 다듬기 + Win 어댑터 |
| 6 | Win 베타 빌드 + 코드 서명 + 100명 베타 |

## 라이선스

현재 클로즈드. v1.0 전 오픈소스 범위 결정 (ADR-0002 예정).

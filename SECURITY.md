# 보안 정책 (Security Policy)

> 본 정책은 EU Cyber Resilience Act (CRA, 2024/2847) 의 사전 정렬을 목적으로 작성되었으며,
> v1.0 출시 전까지 보고 채널과 SLA 를 확정합니다.

## 보안 취약점 보고 (Coordinated Vulnerability Disclosure)

취약점을 발견하셨다면 **공개 이슈 트래커가 아닌** 아래 채널로 보고해 주세요.

- 이메일: `mickeys67@gmail.com` (제목 앞에 `[SECURITY]` 권장)
- PGP 키: `<TBD: 키 ID 또는 keys.openpgp.org URL>`
- 대체 경로: GitHub Security Advisories (`Security` 탭 → `Report a vulnerability`)

보고 시 다음 정보가 있으면 분석이 빠릅니다:

- 영향받는 컴포넌트 (`apps/desktop`, `services/backend`, `packages/mcp-server` 등)
- 재현 단계와 최소 PoC
- 위협 모델 가정 (로컬 / 네트워크 / 권한 상승 등)
- 보고자 연락처와 공개 일정에 대한 선호

## 응답 SLA

| 단계 | 목표 시간 |
|---|---|
| 초기 수신 확인 | 영업일 기준 2일 이내 |
| 위험도 평가 통보 | 영업일 기준 7일 이내 |
| 패치/완화 배포 | 위험도에 따라 14~90일 (Critical 은 14일 이내 우선) |
| 공개 일정 조율 | 보고자와 협의, 기본 90일 |

## 지원 대상 버전

| 버전 | 지원 여부 | 비고 |
|---|---|---|
| `v0.x` (Closed Beta) | ✅ 보안 패치 제공 | v1.0 정식 출시 전까지 |
| `v1.x` 이상 | ✅ <TBD: 최소 N개월 보안 업데이트 보장 — CRA 대응> | v1.0 출시 시 확정 |

## 자동 업데이트

본 앱은 Tauri Updater 를 통해 자동 업데이트를 제공합니다.
업데이트 패키지는 Ed25519 키로 서명되며, 클라이언트가 서명을 검증한 후에만 적용됩니다.
- 서명 키 관리: `<TBD: 키 회전 주기 및 보관 정책>`
- Updater 엔드포인트: `<TBD: backend 도메인>/updates/{target}/{current_version}`

## SBOM (Software Bill of Materials)

각 릴리스에는 의존성 목록이 SBOM(CycloneDX) 으로 첨부됩니다.
로컬에서 직접 생성하려면:

```powershell
.\scripts\generate-sbom.ps1
```

## 책임 있는 공개

본 정책에 따라 보고된 취약점에 대해 운영자는 보고자에게 법적 조치를 취하지 않습니다.
다만 다음 행위는 보호 대상에서 제외됩니다:

- 사용자 데이터 유출/파괴/탈취
- 서비스 거부(DoS) 공격
- 사회공학 공격 (스팸·피싱 포함)
- 물리적 침입·시설 출입
- 제3자 시스템에 대한 공격

## 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-03 | 초기 작성 (CRA 사전 정렬) |

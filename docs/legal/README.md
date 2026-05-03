# 법무 문서 (Legal Documents)

본 디렉터리는 사용자 대면 법무 문서의 SoT (Source of Truth) 입니다.
앱·랜딩·백엔드는 모두 이 문서들을 참조하며, 직접 사본을 두지 않습니다.

## 문서 목록

| 파일 | 용도 | 적용 규제 |
|---|---|---|
| [privacy-policy.md](privacy-policy.md) | 개인정보 처리방침 | PIPA, GDPR, CCPA/CPRA, UK GDPR |
| [terms.md](terms.md) | 서비스 이용약관 / EULA | 약관규제법, EU 소비자권 지침, 디지털 콘텐츠 지침 |
| [data-categories.md](data-categories.md) | 텔레메트리 데이터 카테고리 (코드 SoT) | GDPR Art.30, PIPA 처리현황 |
| [../../LICENSE](../../LICENSE) | 소프트웨어 라이선스 | Closed Beta proprietary |
| [../../SECURITY.md](../../SECURITY.md) | 보안 정책 / CVD | EU CRA 사전 정렬 |

## 출시 전 채워야 할 placeholder

다음 토큰은 모든 법무 문서에서 일괄 검색·치환됩니다.
값을 결정하면 한 PR 로 일괄 갱신하세요.

| 토큰 | 의미 | 수집 채널 |
|---|---|---|
| `<TBD: 사업자/법인명>` | 처리자 명의 | 사업자등록증 / 법인등기부 |
| `<TBD: 사업장 주소>` | 등록 주소 | 동상 |
| `<TBD: 대표자명>` | 대표자 | 동상 |
| `<TBD: 사업자등록번호>` | 사업자번호 또는 "해당 없음" | 동상 |
| `<TBD: 성명·직책>` | 개인정보 보호책임자 | 운영자 결정 |
| `<TBD: privacy@example.com>` | 개인정보 문의 이메일 | 도메인 결정 후 |
| `<TBD: security@example.com>` | 보안 신고 이메일 | 동상 |
| `<TBD: legal@example.com>` | 법무 문의 이메일 | 동상 |
| `<TBD: license@example.com>` | 라이선스 문의 | 동상 |
| `<TBD: hello@example.com>` | 일반 문의 | 동상 |
| `<TBD: 키 ID 또는 keys.openpgp.org URL>` | 보안 보고용 PGP 키 | PGP 키 생성 후 |
| `<TBD: 준거법 — 예: 대한민국 법>` | 준거법 | 운영자 결정 |
| `<TBD: 관할 — 예: 서울중앙지방법원>` | 합의 관할 | 동상 |
| `<TBD: YYYY-MM-DD>` | 시행일 | 출시일 결정 후 |
| `<TBD: 권장 연령 — 예: 만 14세>` | 연령 게이트 | PIPA 14세 / GDPR 16세 / COPPA 13세 중 결정 |
| `<TBD: 예 12개월>` | 텔레메트리 보유기간 | 운영자 결정 |
| `<TBD: 최소 N개월 보안 업데이트 보장>` | CRA 대비 SLA | v1.0 출시 시 결정 |
| `<TBD: 키 회전 주기 및 보관 정책>` | Tauri Updater 키 정책 | 운영자 결정 |
| `<TBD: backend 도메인>` | 자동 업데이트 엔드포인트 | 도메인 결정 후 |
| `<TBD: EU 대리인 (GDPR Art.27) ...>` | EU 대리인 | EU 매출 임계치 도달 시 |
| `<TBD: 기타 SaaS — 예: Sentry, PostHog 사용 시>` | 추가 처리 위탁자 | SaaS 도입 시 |
| `<TBD: SCC 또는 BCR>` | 국제 이전 메커니즘 (한국 외) | 법무 검토 후 |

검색 명령:

```bash
grep -rn "<TBD:" docs/legal/ LICENSE SECURITY.md
```

## 변경 절차

1. 법무 문서 수정 시 SoT(이 디렉터리) 만 수정
2. 사용자 대면 변경(중대 변경) 이면 처리방침 §11, 약관 §12 의 공지 의무 충족
3. `docs/legal/data-categories.md` 변경 시 코드 동기화 필수 (해당 문서 §변경 절차 참조)
4. 변경 후 `grep -n "<TBD:" docs/legal/` 으로 잔존 placeholder 확인

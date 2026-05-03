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

## 운영자 정보 (확정, 2026-04-09 사업자등록)

| 항목 | 값 |
|---|---|
| 상호 | 스티레오 (개인사업자) |
| 대표자 | 김승호 |
| 사업자등록번호 | 169-08-03184 |
| 사업장 주소 | 인천광역시 서구 솔빛로 13 |
| 등록 세무서 | 서인천세무서 |
| 업태 | 정보통신업, 도매 및 소매업 |
| 종목 | 응용 소프트웨어 개발 및 공급업, 전자상거래 소매업 |
| 과세 유형 | 일반과세자 |
| 개업일 | 2026-04-09 |

## 운영자 연락처 (확정)

| 용도 | 채널 |
|---|---|
| 일반·개인정보·보안·법무·라이선스 통합 문의 | mickeys67@gmail.com |

> 향후 도메인 기반 이메일(예: `privacy@…`)로 전환 시 모든 법무 문서 일괄 갱신 필요.

## 잔여 placeholder

베타 단계의 일반적 권장 값으로 모두 채워졌습니다 (`grep -rn "<TBD:" docs/legal/ LICENSE SECURITY.md` 시 `0` 결과).

다음 항목은 트리거가 발생하면 갱신하세요:

| 트리거 | 갱신 대상 | 현재 값 |
|---|---|---|
| EU 매출 임계 도달 | privacy-policy §1 EU 대리인 | 해당 없음 |
| 분석 SDK 도입 (Sentry, PostHog 등) | privacy-policy §5 처리 위탁자 | 추가 위탁자 없음 |
| GDPR-K 별도 동의 절차 도입 | privacy-policy §8 어린이 정보 | 만 14세 기준 |
| 정식 출시 (v1.0) | privacy-policy / terms 시행일, SECURITY 보안 SLA 시작점 | 2026-05-03 (베타 초안) |
| 커스텀 도메인 발급 | SECURITY Updater 엔드포인트 | tg-backend.mickeys67.workers.dev |
| PGP 키 발급 | SECURITY 보안 보고 채널 | PGP 미사용 |

## 변경 절차

1. 법무 문서 수정 시 SoT(이 디렉터리) 만 수정
2. 사용자 대면 변경(중대 변경) 이면 처리방침 §11, 약관 §12 의 공지 의무 충족
3. `docs/legal/data-categories.md` 변경 시 코드 동기화 필수 (해당 문서 §변경 절차 참조)
4. 변경 후 `grep -rn "<TBD:" docs/legal/ LICENSE SECURITY.md` 으로 잔존 placeholder 확인 (정상이면 결과 없음)

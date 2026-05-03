// 법무 문서 링크 헬퍼.
// 백엔드의 /legal/{kind} 가 운영자가 설정한 URL(GitHub raw, docs 사이트 등)로 redirect 합니다.
// 도메인을 코드에 박지 않기 위한 우회 — 운영자 결정 후 backend 환경변수로 주입.

const BACKEND =
  (import.meta.env.VITE_TG_BACKEND as string | undefined) ??
  "https://api.terminalguardian.kr";

export type LegalKind = "privacy" | "terms" | "security" | "license";

export function legalUrl(kind: LegalKind): string {
  return `${BACKEND}/legal/${kind}`;
}

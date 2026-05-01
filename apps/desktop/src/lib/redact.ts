// 자동 가림 — AI에 보내기 전 민감 정보 감지.
// OCR 텍스트 기반 패턴 매칭 (이미지 자체는 클라이언트가 처리).

export type RedactionHit = {
  kind: "password" | "email" | "card" | "apikey" | "krrrn" | "phone";
  label: string;
  preview: string;
};

const PATTERNS: Array<{
  kind: RedactionHit["kind"];
  label: string;
  re: RegExp;
}> = [
  {
    kind: "apikey",
    label: "API 키",
    re: /\b(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|xoxb-[A-Za-z0-9-]{20,}|AIza[A-Za-z0-9_-]{30,})\b/g,
  },
  {
    kind: "card",
    label: "신용카드 번호 같은 숫자",
    re: /\b(?:\d[ -]?){13,16}\b/g,
  },
  {
    kind: "krrrn",
    label: "주민등록번호 같은 숫자",
    re: /\b\d{6}[ -]?[1-4]\d{6}\b/g,
  },
  {
    kind: "email",
    label: "이메일 주소",
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    kind: "phone",
    label: "전화번호",
    re: /\b(?:01[016789][- ]?\d{3,4}[- ]?\d{4}|\+?\d{1,3}[- ]?\d{3,4}[- ]?\d{4})\b/g,
  },
  {
    kind: "password",
    label: "비밀번호 같은 글자",
    re: /\b(password|passwd|pwd|비밀번호)\s*[:=]\s*\S+/gi,
  },
];

export function detectSensitive(text: string): RedactionHit[] {
  const hits: RedactionHit[] = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text)) !== null) {
      const raw = m[0];
      hits.push({
        kind: p.kind,
        label: p.label,
        preview: raw.length > 12 ? `${raw.slice(0, 4)}…${raw.slice(-2)}` : raw,
      });
    }
  }
  return hits;
}

export function redactText(text: string): {
  redacted: string;
  hits: RedactionHit[];
} {
  const hits = detectSensitive(text);
  let result = text;
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    result = result.replace(p.re, () => `[${p.label} 가려짐]`);
  }
  return { redacted: result, hits };
}

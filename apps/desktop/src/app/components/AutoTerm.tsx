// AutoTerm — 글로서리에 등록된 용어를 텍스트 안에서 자동 감지·Tooltip 으로 감쌈.
// <AutoTerm>이 텍스트는 PowerShell 에서 Python 으로 만든 코드를 실행해요</AutoTerm>
// → "PowerShell" 과 "Python" 만 점선 + 호버 풀이.

import { Fragment, type ReactNode } from "react";
import { GLOSSARY } from "@/lib/glossary";
import { Tooltip } from "./Tooltip";

interface Props {
  children: string;
  className?: string;
}

/** 별칭 → 글로서리 키 매핑. 사용자가 변형으로 적어도 같은 풀이 노출. */
const ALIASES: Record<string, string> = {
  // 영문 변형
  "Power Shell": "PowerShell",
  powershell: "PowerShell",
  Powershell: "PowerShell",
  Botfather: "BotFather",
  botfather: "BotFather",
  "Bot Father": "BotFather",
  "Visual Env": "venv",
  ".env": "dotenv",
  Dotenv: "dotenv",
  WiFi: "Wi-Fi",
  wifi: "Wi-Fi",
  github: "GitHub",
  Github: "GitHub",
  vercel: "Vercel",
  cloudflare: "Cloudflare",
  msi: "MSI",
  exe: "EXE",
  zip: "ZIP",
  // 한글 변형 (반드시 GLOSSARY 키로 매핑)
  파워쉘: "PowerShell",
  파이썬: "Python",
  깃: "Git",
  노드: "Node",
  엔피엠: "npm",
  리액트: "React",
  스트림릿: "Streamlit",
  큐알: "QR",
  와이파이: "Wi-Fi",
  깃허브: "GitHub",
  버셀: "Vercel",
  클라우드플레어: "Cloudflare",
  도커: "Docker", // 글로서리 없는 키는 무시됨 (resolveKey 가 가드)
  비주얼이엔브이: "venv",
  "도트 env": "dotenv",
  "닷에이치티엠엘": "html",
};

// 매치 대상 = 글로서리 키 + 별칭. 길이 내림차순.
const ALL_TERMS = [...Object.keys(GLOSSARY), ...Object.keys(ALIASES)].sort(
  (a, b) => b.length - a.length,
);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TERM_PATTERN = new RegExp(`(${ALL_TERMS.map(escapeRegex).join("|")})`, "g");

function resolveKey(part: string): string | null {
  if (part in GLOSSARY) return part;
  if (part in ALIASES) return ALIASES[part]!;
  return null;
}

export function AutoTerm({ children, className }: Props) {
  if (!children) return null;
  if (typeof children !== "string") return <span className={className}>{children}</span>;

  const parts = children.split(TERM_PATTERN);
  const nodes: ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? "";
    const key = i % 2 === 1 ? resolveKey(part) : null;
    if (key) {
      nodes.push(
        <Tooltip key={i} term={key}>
          {part}
        </Tooltip>,
      );
    } else if (part) {
      nodes.push(<Fragment key={i}>{part}</Fragment>);
    }
  }

  return <span className={className}>{nodes}</span>;
}

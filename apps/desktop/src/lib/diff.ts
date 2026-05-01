// 두 HTML 사이 차이를 입문자가 알아보기 쉽게 요약.
// 정밀 diff 가 아니라 "뭐가 바뀌었는지 한 줄로" 가 목적.

export type DiffSummary = {
  charsBefore: number;
  charsAfter: number;
  linesBefore: number;
  linesAfter: number;
  changes: string[];
  /** 변화 0 = 똑같음 */
  identical: boolean;
};

/** 단순 hex 색상 추출. */
function extractColors(html: string): Set<string> {
  const set = new Set<string>();
  const re = /#[0-9A-Fa-f]{6}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    set.add(m[0].toLowerCase());
  }
  return set;
}

/** <태그> 갯수 세기. */
function countTag(html: string, tag: string): number {
  const re = new RegExp(`<${tag}\\b`, "gi");
  return (html.match(re) ?? []).length;
}

export function summarizeDiff(before: string, after: string): DiffSummary {
  const charsBefore = before.length;
  const charsAfter = after.length;
  const linesBefore = before.split("\n").length;
  const linesAfter = after.split("\n").length;
  const changes: string[] = [];

  // 색상 변경 감지.
  const colorsBefore = extractColors(before);
  const colorsAfter = extractColors(after);
  const removed = [...colorsBefore].filter((c) => !colorsAfter.has(c));
  const added = [...colorsAfter].filter((c) => !colorsBefore.has(c));
  if (removed.length || added.length) {
    if (removed.length === 1 && added.length === 1) {
      changes.push(`🎨 색깔 바뀜 (${removed[0]} → ${added[0]})`);
    } else {
      changes.push(
        `🎨 색깔 ${added.length > 0 ? added.length + "개 추가" : ""}${
          removed.length > 0 ? (added.length ? " · " : "") + removed.length + "개 사라짐" : ""
        }`,
      );
    }
  }

  // 태그 추가/제거.
  for (const tag of ["img", "button", "a", "input", "h1", "h2", "h3", "p", "div"]) {
    const a = countTag(before, tag);
    const b = countTag(after, tag);
    if (b > a) changes.push(`➕ <${tag}> ${b - a}개 추가`);
    else if (b < a) changes.push(`➖ <${tag}> ${a - b}개 사라짐`);
  }

  // 폰트 크기 변경 감지.
  const fontBefore = /font-size:\s*(\d+)/.exec(before)?.[1];
  const fontAfter = /font-size:\s*(\d+)/.exec(after)?.[1];
  if (fontBefore && fontAfter && fontBefore !== fontAfter) {
    const diff = Number(fontAfter) - Number(fontBefore);
    if (diff !== 0) {
      changes.push(
        `🔤 글자 크기 ${diff > 0 ? "+" : ""}${diff}px (${fontBefore}px → ${fontAfter}px)`,
      );
    }
  }

  // 변화 0 — 진짜 똑같음.
  const identical = before === after;
  if (identical) changes.push("⚠️ 변화 없음 — 이전과 똑같아요");
  else if (changes.length === 0) {
    // 글자 차이만 있을 때.
    const delta = charsAfter - charsBefore;
    changes.push(`✏️ 내용 ${delta > 0 ? "+" : ""}${delta}자 변경`);
  }

  return {
    charsBefore,
    charsAfter,
    linesBefore,
    linesAfter,
    changes,
    identical,
  };
}

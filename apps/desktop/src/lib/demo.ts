// 브라우저 데모 모드 모킹 — Tauri 명령이 닿지 않을 때 가짜 응답.
// 사용자 요청 키워드에 따라 HTML 을 진짜로 변형해서 "데모인데 진짜 같음" 을 줌.

export const DEMO_DEFAULT_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>(데모) 내 소개</title>
  <style>
    body { font-family: system-ui; background: #4ECDC4; color: white;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; }
    .card { background: rgba(255,255,255,0.15); padding: 40px 60px;
            border-radius: 16px; text-align: center; backdrop-filter: blur(10px); }
    h1 { margin: 0 0 8px; font-size: 36px; }
    p { margin: 0; opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <h1>안녕하세요 👋</h1>
    <p>가디언이 만들어준 내 첫 페이지예요.</p>
  </div>
</body>
</html>`;

const DEMO_COLORS: Array<{ re: RegExp; hex: string; label: string }> = [
  { re: /분홍|핑크|pink/i, hex: "#FFB6D5", label: "분홍" },
  { re: /파란|블루|blue/i, hex: "#4A90E2", label: "파랑" },
  { re: /노란|옐로|yellow/i, hex: "#FFD93D", label: "노랑" },
  { re: /빨간|레드|red/i, hex: "#FF6B6B", label: "빨강" },
  { re: /보라|퍼플|purple/i, hex: "#9B59B6", label: "보라" },
  { re: /초록|그린|green/i, hex: "#2ECC71", label: "초록" },
  { re: /검은|블랙|black/i, hex: "#222222", label: "검정" },
  { re: /하얀|흰|화이트|white/i, hex: "#F5F5F5", label: "흰" },
  { re: /주황|오렌지|orange/i, hex: "#F39C12", label: "주황" },
];

/**
 * 사용자 요청 키워드를 분석해 현재 HTML 을 변형. 데모 모드 전용.
 * 입문자가 시연할 때 "진짜 바뀌는구나" 를 체감하게 하는 게 목적.
 */
export function transformDemoHtml(
  currentHtml: string,
  userRequest: string,
): string {
  let html = currentHtml || DEMO_DEFAULT_HTML;

  // 색상 변경.
  for (const c of DEMO_COLORS) {
    if (c.re.test(userRequest)) {
      html = html.replace(/#[0-9A-Fa-f]{6}\b/g, (m) =>
        m.toLowerCase() === "#ffffff" || m.toLowerCase() === "#fff" ? m : c.hex,
      );
      html = html.replace(
        /(background(?:-color)?\s*:)\s*[^;}\n]+/gi,
        `$1 ${c.hex}`,
      );
      break;
    }
  }

  // 사진 추가.
  if (/사진|이미지|image|img/i.test(userRequest) && !/<img\b/i.test(html)) {
    const seed = Math.floor(Math.random() * 1000);
    const imgTag = `\n  <img src="https://picsum.photos/seed/${seed}/200/200" alt="(데모) 사진" style="border-radius: 50%; width: 140px; height: 140px; margin: 20px auto; display: block; box-shadow: 0 8px 24px rgba(0,0,0,0.15);">`;
    html = html.replace(/<\/h1>/i, `</h1>${imgTag}`);
  } else if (/사진|이미지|image|img/i.test(userRequest)) {
    const seed = Math.floor(Math.random() * 1000);
    html = html.replace(
      /<\/body>/i,
      `  <img src="https://picsum.photos/seed/${seed}/200/200" alt="" style="border-radius:12px;width:120px;margin:12px;">\n</body>`,
    );
  }

  // 버튼 추가.
  if (/버튼|button/i.test(userRequest) && !/<button\b/i.test(html)) {
    const btnTag = `\n  <button onclick="alert('안녕! 데모 버튼이에요.')" style="margin-top: 20px; padding: 12px 28px; font-size: 16px; border-radius: 999px; border: 2px solid white; background: rgba(255,255,255,0.2); color: white; cursor: pointer; backdrop-filter: blur(10px);">눌러보세요</button>`;
    html = html.replace(/<\/p>/i, `</p>${btnTag}`);
  }

  // 글자 크기.
  if (/큰|크게|키워|larger|bigger|big/i.test(userRequest)) {
    html = html.replace(/font-size:\s*(\d+)px/gi, (_m, n) => {
      const num = Math.min(Number(n) + 12, 96);
      return `font-size: ${num}px`;
    });
    if (!/h1\s*{[^}]*font-size/.test(html)) {
      html = html.replace(/h1\s*{/, "h1 { font-size: 56px;");
    }
  }

  if (/작은|작게|smaller/i.test(userRequest)) {
    html = html.replace(/font-size:\s*(\d+)px/gi, (_m, n) => {
      const num = Math.max(Number(n) - 8, 12);
      return `font-size: ${num}px`;
    });
  }

  if (/둥글|round|circle/i.test(userRequest)) {
    html = html.replace(
      /\.card\s*{([^}]*)}/,
      (_m, body) =>
        `.card {${body.replace(/border-radius:\s*[^;]+;/, "")} border-radius: 32px;}`,
    );
  }

  if (/그림자|shadow/i.test(userRequest)) {
    if (!/box-shadow/.test(html)) {
      html = html.replace(
        /\.card\s*{/,
        ".card { box-shadow: 0 16px 48px rgba(0,0,0,0.3);",
      );
    }
  }

  // 어떤 키워드도 안 맞으면 — 작은 코멘트로 변화 표시.
  if (html === currentHtml) {
    const stamp = `<!-- (데모 모드) "${userRequest.slice(0, 40)}" 요청을 받았지만 정확한 변형을 못 찾아서 코멘트만 추가했어요. 키워드 예: 분홍/사진/버튼/큰 글씨/그림자/둥글게 -->`;
    html = html.replace(/<\/body>/i, `${stamp}\n</body>`);
  }

  return html;
}

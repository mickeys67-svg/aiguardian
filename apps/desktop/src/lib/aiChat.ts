// AI 챗 — v0.1 에서는 로컬 모킹 + 실제 API 연결을 위한 인터페이스.
// 향후 services/backend 의 Cloudflare Worker 가 Anthropic API 를 프록시할 예정.

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  /** 있다면 첨부 이미지 dataURL */
  imageDataUrl?: string;
  /** 추출된 명령어 — UI 가 [복사][실행] 버튼으로 노출 */
  suggestedCommands?: string[];
  createdAt: string;
};

export type ChatContext = {
  /** 어느 화면에서 호출됐는지 — 백엔드 컨텍스트용 */
  screen?: string;
  /** 최근 에러 메시지 */
  lastError?: string;
  /** 진행 중인 레시피 ID */
  recipeId?: string;
};

export type SendChatInput = {
  text: string;
  imageDataUrl?: string;
  context: ChatContext;
};

export type SendChatOutput = {
  reply: ChatMessage;
};

/** 실제 백엔드 연결 전 — 로컬 모킹. */
async function mockReply(input: SendChatInput): Promise<ChatMessage> {
  await new Promise((r) => setTimeout(r, 700));
  const hasImage = !!input.imageDataUrl;
  const txt = (input.text || "").toLowerCase();
  let body =
    "지금은 가디언 데모 모드라 실제 답변 대신 가이드만 드려요.\n\n" +
    (hasImage
      ? "이미지를 잘 받았어요. 어떤 부분이 막혔는지 살펴보고 다음에 뭘 하면 좋을지 알려드릴게요.\n"
      : "어떤 화면이 막혔는지 📸 버튼으로 캡처해 보내주시면 더 정확하게 도와드려요.\n");
  let suggested: string[] | undefined;

  if (txt.includes("npm") || txt.includes("install")) {
    body += "\n혹시 'command not found'이 떴다면 Node가 안 깔린 거예요.";
    suggested = ["npm --version"];
  } else if (txt.includes("git")) {
    body += "\nGit 관련은 'git --version'으로 먼저 확인해보세요.";
    suggested = ["git --version"];
  }

  return {
    id: `msg-${Date.now().toString(36)}`,
    role: "assistant",
    text: body,
    suggestedCommands: suggested,
    createdAt: new Date().toISOString(),
  };
}

export async function sendChat(input: SendChatInput): Promise<SendChatOutput> {
  // 향후 실제 호출:
  // const r = await fetch(`${BACKEND_URL}/chat`, { method: "POST", body: JSON.stringify(input) });
  // const reply = await r.json();
  const reply = await mockReply(input);
  return { reply };
}

export function makeUserMessage(
  text: string,
  imageDataUrl?: string,
): ChatMessage {
  return {
    id: `msg-${Date.now().toString(36)}-u`,
    role: "user",
    text,
    imageDataUrl,
    createdAt: new Date().toISOString(),
  };
}

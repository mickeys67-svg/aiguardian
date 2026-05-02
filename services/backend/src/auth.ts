// Google OAuth 2.0 + D1 세션.
// 흐름: GET /auth/google → Google 동의 화면 → /auth/google/callback → 세션 쿠키 + redirect.

import type { Context } from "hono";

export type Env = {
  DB?: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** 로그인 후 돌아갈 호스트 — 운영: https://vibemate.kr */
  WEB_ORIGIN?: string;
};

const SESSION_TTL_DAYS = 30;

/** 토큰 — 32바이트 랜덤 base64url. */
function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function newUserId(): string {
  return "u_" + newToken().slice(0, 16);
}

/** Google 로그인 시작 — 동의 URL 로 302. */
export async function googleStart(c: Context<{ Bindings: Env }>) {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return c.json({ error: "google_client_id_missing" }, 500);
  }
  const redirectUri = new URL("/auth/google/callback", c.req.url).toString();
  const state = newToken().slice(0, 22);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });
  // state 는 쿠키로 검증 — CSRF 방어.
  c.header(
    "Set-Cookie",
    `oauth_state=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`,
  );
  return c.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}

/** Google 콜백 — code 교환 → 사용자 정보 → upsert → 세션 → 리다이렉트. */
export async function googleCallback(c: Context<{ Bindings: Env }>) {
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = parseCookie(c.req.header("cookie") || "")["oauth_state"];

  if (!code || !state || state !== cookieState) {
    return c.json({ error: "invalid_state" }, 400);
  }

  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return c.json({ error: "oauth_not_configured" }, 500);
  }

  // 1) code → access_token + id_token
  const redirectUri = new URL("/auth/google/callback", c.req.url).toString();
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!tokenRes.ok) {
    return c.json({ error: "token_exchange_failed" }, 400);
  }
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    id_token?: string;
  };

  // 2) userinfo
  const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userRes.ok) {
    return c.json({ error: "userinfo_failed" }, 400);
  }
  const profile = (await userRes.json()) as {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
    email_verified?: boolean;
  };

  if (!profile.email_verified) {
    return c.json({ error: "email_not_verified" }, 403);
  }

  if (!c.env.DB) {
    return c.json({ error: "db_unavailable" }, 500);
  }

  // 3) users upsert
  const existing = await c.env.DB.prepare(
    "SELECT id FROM users WHERE google_sub = ?1 OR email = ?2",
  )
    .bind(profile.sub, profile.email)
    .first<{ id: string }>();

  let userId: string;
  if (existing) {
    userId = existing.id;
    await c.env.DB.prepare(
      "UPDATE users SET google_sub = ?1, email = ?2, name = ?3, picture = ?4, last_login_at = datetime('now') WHERE id = ?5",
    )
      .bind(
        profile.sub,
        profile.email,
        profile.name ?? null,
        profile.picture ?? null,
        userId,
      )
      .run();
  } else {
    userId = newUserId();
    await c.env.DB.prepare(
      "INSERT INTO users (id, email, google_sub, name, picture, plan, last_login_at) VALUES (?1, ?2, ?3, ?4, ?5, 'free', datetime('now'))",
    )
      .bind(
        userId,
        profile.email,
        profile.sub,
        profile.name ?? null,
        profile.picture ?? null,
      )
      .run();
  }

  // 4) 세션 발급
  const sessionToken = newToken();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  await c.env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at, user_agent, ip) VALUES (?1, ?2, ?3, ?4, ?5)",
  )
    .bind(
      sessionToken,
      userId,
      expiresAt,
      c.req.header("user-agent") ?? null,
      c.req.header("cf-connecting-ip") ?? null,
    )
    .run();

  // 5) 쿠키 + 리다이렉트
  const webOrigin = c.env.WEB_ORIGIN || "https://vibemate.kr";
  c.header("Set-Cookie", [
    `vm_session=${sessionToken}; Path=/; Domain=.vibemate.kr; Secure; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_DAYS * 24 * 60 * 60}`,
    `oauth_state=; Path=/; Max-Age=0`,
  ].join(", "));

  return c.redirect(`${webOrigin}/welcome`);
}

/** 현재 세션 정보 — /me 엔드포인트. */
export async function meHandler(c: Context<{ Bindings: Env }>) {
  const session = await loadSession(c);
  if (!session) {
    return c.json({ authenticated: false }, 401);
  }
  // 멤버 카운터 — 가입자 총 수.
  const totalRow = await c.env.DB!.prepare(
    "SELECT COUNT(*) AS n FROM users",
  ).first<{ n: number }>();
  return c.json({
    authenticated: true,
    user: {
      email: session.email,
      name: session.name,
      picture: session.picture,
      memberNumber: session.member_number,
    },
    totalMembers: totalRow?.n ?? 0,
  });
}

/** 로그아웃. */
export async function logoutHandler(c: Context<{ Bindings: Env }>) {
  const cookies = parseCookie(c.req.header("cookie") || "");
  const token = cookies["vm_session"];
  if (token && c.env.DB) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE token = ?1").bind(token).run();
  }
  c.header(
    "Set-Cookie",
    `vm_session=; Path=/; Domain=.vibemate.kr; Secure; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  return c.json({ ok: true });
}

export type SessionUser = {
  user_id: string;
  email: string;
  name: string | null;
  picture: string | null;
  member_number: number;
};

/** 쿠키 → 세션 조회. 만료된 세션은 자동 삭제. */
export async function loadSession(
  c: Context<{ Bindings: Env }>,
): Promise<SessionUser | null> {
  if (!c.env.DB) return null;
  const cookies = parseCookie(c.req.header("cookie") || "");
  const token = cookies["vm_session"];
  if (!token) return null;
  const row = await c.env.DB.prepare(
    `SELECT u.id AS user_id, u.email, u.name, u.picture,
            (SELECT COUNT(*) FROM users u2 WHERE u2.created_at <= u.created_at) AS member_number
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ?1 AND s.expires_at > datetime('now')`,
  )
    .bind(token)
    .first<SessionUser>();
  return row ?? null;
}

/** 쿠키 헤더 파싱 — 라이브러리 의존 회피. */
function parseCookie(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

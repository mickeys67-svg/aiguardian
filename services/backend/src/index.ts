import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  buildUpdaterResponse,
  fetchSignature,
  getLatestRelease,
  pickAsset,
} from "./github.js";
import {
  googleStart,
  googleCallback,
  meHandler,
  logoutHandler,
  loadSession,
} from "./auth.js";

type Bindings = {
  DB?: D1Database;
  CACHE?: KVNamespace;
  GH_OWNER?: string;
  GH_REPO?: string;
  GH_TOKEN?: string;
  PURGE_TOKEN?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  WEB_ORIGIN?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// 보안 헤더 — 모든 응답에 일괄 적용.
app.use("*", async (c, next) => {
  await next();
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "interest-cohort=()");
});

// CORS — 운영 도메인 화이트리스트. credentials 허용 (세션 쿠키).
const ALLOWED_ORIGINS = [
  "https://vibemate.kr",
  "https://www.vibemate.kr",
  "https://tg-landing.pages.dev",
  "http://localhost:1420",
  "http://localhost:4321",
  "http://localhost:5173",
  "tauri://localhost",
];
app.use(
  "*",
  cors({
    // 화이트리스트 외 origin 은 null 반환 → 브라우저 CORS 거부 (credentials wildcard 함정 방어).
    origin: (origin) => (ALLOWED_ORIGINS.includes(origin) ? origin : null),
    allowHeaders: ["content-type"],
    credentials: true,
  }),
);

// ────────────────────────────────────────────────────────────────────────────
// 인증 — Google OAuth + 세션
// ────────────────────────────────────────────────────────────────────────────

app.get("/auth/google", googleStart);
app.get("/auth/google/callback", googleCallback);
app.get("/me", meHandler);
app.post("/auth/logout", logoutHandler);

app.get("/health", (c) =>
  c.json({ ok: true, service: "tg-backend", name: "Vibemate Backend", version: "0.2.4" }),
);

// ────────────────────────────────────────────────────────────────────────────
// 레시피
// ────────────────────────────────────────────────────────────────────────────

app.get("/recipes", async (c) => {
  if (!c.env.DB) return c.json({ recipes: [] });
  const { results } = await c.env.DB.prepare(
    "SELECT id, title, category, difficulty, est_minutes as estMinutes, description, outcome, featured FROM recipes ORDER BY featured DESC, est_minutes ASC",
  ).all();
  return c.json({ recipes: results });
});

app.get("/recipes/:id", async (c) => {
  const id = c.req.param("id");
  if (!c.env.DB) return c.json({ error: "not found" }, 404);
  const row = await c.env.DB.prepare(
    "SELECT id, title, category, difficulty, est_minutes as estMinutes, description, outcome, requires, prompt_template as promptTemplate, steps, featured FROM recipes WHERE id = ?",
  )
    .bind(id)
    .first();
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

// ────────────────────────────────────────────────────────────────────────────
// 텔레메트리 (v0.9 §4.5 옵트인)
// ────────────────────────────────────────────────────────────────────────────

app.post("/telemetry", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "invalid body" }, 400);
  }
  const { event, anonId, timestamp, appVersion, props } = body as Record<
    string,
    unknown
  >;
  if (typeof event !== "string" || typeof anonId !== "string") {
    return c.json({ error: "missing fields" }, 400);
  }
  if (c.env.DB) {
    await c.env.DB.prepare(
      "INSERT INTO telemetry_events (event, anon_id, timestamp, app_version, props) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(
        event,
        anonId,
        typeof timestamp === "string" ? timestamp : new Date().toISOString(),
        typeof appVersion === "string" ? appVersion : null,
        props ? JSON.stringify(props) : null,
      )
      .run();
  }
  return c.json({ accepted: true });
});

app.get("/error-patterns", async (c) => {
  if (!c.env.DB) return c.json({ patterns: [] });
  const { results } = await c.env.DB.prepare(
    "SELECT id, pattern, lang, solution, frequency FROM error_patterns ORDER BY frequency DESC LIMIT 200",
  ).all();
  return c.json({ patterns: results });
});

// ────────────────────────────────────────────────────────────────────────────
// 다운로드 — GitHub Releases 프록시
// ────────────────────────────────────────────────────────────────────────────

/** 랜딩 페이지가 부르는 메타 — 최신 버전·자산 목록 */
app.get("/latest", async (c) => {
  const release = await getLatestRelease(c.env);
  if (!release) {
    return c.json(
      {
        error: "no release available",
        hint: "GH_OWNER/GH_REPO env 설정 + 첫 GitHub Release 발행 필요",
      },
      503,
    );
  }
  return c.json({
    version: release.tag_name.replace(/^v/, ""),
    publishedAt: release.published_at,
    notes: release.body,
    assets: release.assets.map((a) => ({
      name: a.name,
      size: a.size,
      url: a.browser_download_url,
    })),
  });
});

/**
 * 사용자 OS별 다운로드 진입점 — 로그인 필수 (정식 서비스).
 *   /download/win, /download/mac, /download/mac-arm, /download/mac-intel, /download/linux
 * 인증 후 GitHub Releases 자산 URL로 302 redirect + downloads 로그.
 */
app.get("/download/:platform", async (c) => {
  // 인증 게이트 — 로그인 안 했으면 로그인 화면으로.
  const session = await loadSession(c);
  if (!session) {
    const webOrigin = c.env.WEB_ORIGIN || "https://vibemate.kr";
    return c.redirect(`${webOrigin}/?login_required=1`, 302);
  }

  const platform = c.req.param("platform");
  const release = await getLatestRelease(c.env);
  if (!release) {
    return c.json({ error: "no release available" }, 503);
  }

  const asset = (() => {
    switch (platform) {
      case "win":
      case "windows":
        return pickAsset(release, "windows");
      case "win-msi":
        // AhnLab/V3 등 NSIS 차단 회피용 MSI 강제.
        return pickAsset(release, "windows", undefined, "msi");
      case "mac":
        return pickAsset(release, "macos", "universal");
      case "mac-arm":
      case "mac-aarch64":
        return pickAsset(release, "macos", "aarch64");
      case "mac-intel":
      case "mac-x64":
        return pickAsset(release, "macos", "x64");
      case "linux":
        return pickAsset(release, "linux");
      default:
        return null;
    }
  })();

  if (!asset) {
    return c.json(
      { error: "no matching asset", platform, release: release.tag_name },
      404,
    );
  }

  // 다운로드 로그 + 카운터.
  if (c.env.DB) {
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO downloads (user_id, platform, version, user_agent) VALUES (?1, ?2, ?3, ?4)",
      ).bind(
        session.user_id,
        platform,
        release.tag_name,
        c.req.header("user-agent") ?? null,
      ),
      c.env.DB.prepare(
        "UPDATE users SET download_count = download_count + 1 WHERE id = ?1",
      ).bind(session.user_id),
    ]);
  }

  return c.redirect(asset.browser_download_url, 302);
});

// ────────────────────────────────────────────────────────────────────────────
// Tauri Updater 엔드포인트
// 형식: /updates/{target}/{current_version}
// target ∈ {darwin-aarch64, darwin-x86_64, windows-x86_64, linux-x86_64}
// ────────────────────────────────────────────────────────────────────────────

const UPDATER_TARGETS = [
  "darwin-aarch64",
  "darwin-x86_64",
  "windows-x86_64",
  "linux-x86_64",
] as const;
type UpdaterTarget = (typeof UPDATER_TARGETS)[number];

app.get("/updates/:target/:current_version", async (c) => {
  const target = c.req.param("target") as UpdaterTarget;
  const current = c.req.param("current_version");

  if (!UPDATER_TARGETS.includes(target)) {
    return c.json({ error: "unknown target" }, 400);
  }

  const release = await getLatestRelease(c.env);
  if (!release) {
    return new Response(null, { status: 204 });
  }

  const latestVersion = release.tag_name.replace(/^v/, "");
  if (compareVersions(latestVersion, current) <= 0) {
    return new Response(null, { status: 204 });
  }

  const meta = buildUpdaterResponse(release, target);
  if (!meta) {
    return new Response(null, { status: 204 });
  }

  // .sig 파일 동봉 (Tauri Updater는 base64 또는 평문 시그니처 기대).
  const sigAsset = release.assets.find(
    (a) => a.name.toLowerCase() === `${getMatchingBundle(release, target)?.toLowerCase()}.sig`,
  );
  if (sigAsset) {
    meta.signature = await fetchSignature(sigAsset.browser_download_url);
  }

  return c.json(meta);
});

function getMatchingBundle(
  release: { assets: { name: string }[] },
  target: UpdaterTarget,
): string | null {
  const lower = release.assets.map((a) => a.name);
  const matchers: Record<UpdaterTarget, (n: string) => boolean> = {
    "darwin-aarch64": (n) =>
      n.toLowerCase().includes("aarch64") &&
      n.toLowerCase().endsWith(".app.tar.gz"),
    "darwin-x86_64": (n) =>
      n.toLowerCase().includes("x64") && n.toLowerCase().endsWith(".app.tar.gz"),
    "windows-x86_64": (n) => n.toLowerCase().endsWith(".nsis.zip"),
    "linux-x86_64": (n) => n.toLowerCase().endsWith(".appimage.tar.gz"),
  };
  return lower.find(matchers[target]) ?? null;
}

/** 단순 SemVer 비교: 1 if a > b, -1 if a < b, 0 if equal */
function compareVersions(a: string, b: string): number {
  const ax = a.split(".").map((n) => parseInt(n, 10) || 0);
  const bx = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(ax.length, bx.length);
  for (let i = 0; i < len; i++) {
    const av = ax[i] ?? 0;
    const bv = bx[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

/** Constant-time 문자열 비교 — timing attack 방어. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** GitHub Actions release 직후 캐시 무효화. Bearer 토큰 필요. */
app.post("/admin/purge", async (c) => {
  const auth = c.req.header("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!c.env.PURGE_TOKEN || !timingSafeEqual(token, c.env.PURGE_TOKEN)) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const body = await c.req.json().catch(() => ({}));
  const key = (body as { key?: string }).key ?? "gh:latest-release";
  if (c.env.CACHE) {
    await c.env.CACHE.delete(key);
  }
  return c.json({ purged: key });
});

// Cron — 만료 세션 자동 정리 (매일 자정 KST).
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) {
    if (!env.DB) return;
    const result = await env.DB.prepare(
      "DELETE FROM sessions WHERE expires_at < datetime('now')",
    ).run();
    console.log(`[cron] expired sessions cleanup: ${result.meta.changes ?? 0} rows`);
  },
};

import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  buildUpdaterResponse,
  fetchSignature,
  getLatestRelease,
  pickAsset,
} from "./github.js";

type Bindings = {
  DB?: D1Database;
  CACHE?: KVNamespace;
  GH_OWNER?: string;
  GH_REPO?: string;
  GH_TOKEN?: string;
  PURGE_TOKEN?: string;
  // 법무 문서 redirect 대상 (운영자가 wrangler secret 으로 주입).
  // 미설정 시 503 + 안내 메시지.
  LEGAL_PRIVACY_URL?: string;
  LEGAL_TERMS_URL?: string;
  LEGAL_SECURITY_URL?: string;
  LEGAL_LICENSE_URL?: string;
};

// docs/legal/data-categories.md 와 동기화. 화이트리스트 외 키는 거부.
const TELEMETRY_EVENT_PROPS: Record<string, ReadonlySet<string>> = {
  "tg.stage.entered": new Set(["stage", "os"]),
  "tg.tip.shown": new Set(["tipId", "priority"]),
  "tg.command.executed": new Set([
    "recipeId",
    "stepIndex",
    "outcome",
    "durationBucket",
  ]),
  "tg.error.captured": new Set(["errorClass", "recipeId"]),
  "tg.deploy.completed": new Set(["target", "recipeId", "firstTime"]),
};

const TELEMETRY_BLOCKED_KEYS = new Set([
  "email",
  "name",
  "phone",
  "address",
  "ip",
  "mac",
  "deviceId",
  "serial",
  "command",
  "stdout",
  "stderr",
  "code",
  "prompt",
  "path",
  "filename",
  "cwd",
  "apiKey",
  "token",
  "password",
  "secret",
]);

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({ origin: "*", allowHeaders: ["content-type"] }));

app.get("/health", (c) =>
  c.json({ ok: true, service: "tg-backend", version: "0.1.0" }),
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
  // 알려진 이벤트만 허용 — data-categories.md 의 카탈로그 외 거부.
  const allowedKeys = TELEMETRY_EVENT_PROPS[event];
  if (!allowedKeys) {
    return c.json({ error: "unknown event" }, 400);
  }
  // anonId 형식: UUID v4 만 허용 (개인 식별자 우회 차단).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(anonId)) {
    return c.json({ error: "invalid anonId" }, 400);
  }
  // props 검증: 차단 키 거부 + 화이트리스트 외 키 제거.
  let cleanProps: Record<string, unknown> | null = null;
  if (props && typeof props === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
      if (TELEMETRY_BLOCKED_KEYS.has(k)) {
        return c.json({ error: "blocked key", key: k }, 400);
      }
      if (allowedKeys.has(k)) {
        out[k] = v;
      }
    }
    cleanProps = out;
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
        cleanProps ? JSON.stringify(cleanProps) : null,
      )
      .run();
  }
  return c.json({ accepted: true });
});

/**
 * 정보주체의 삭제권 (GDPR Art.17 / PIPA §36 / CCPA §1798.105).
 * 익명 ID 기반이므로 본인 인증 불필요 — 본인의 anonId 를 아는 사람만 삭제 가능.
 */
app.delete("/telemetry/:anonId", async (c) => {
  const anonId = c.req.param("anonId");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(anonId)) {
    return c.json({ error: "invalid anonId" }, 400);
  }
  if (!c.env.DB) {
    return c.json({ deleted: 0, note: "no DB binding" });
  }
  const res = await c.env.DB.prepare(
    "DELETE FROM telemetry_events WHERE anon_id = ?",
  )
    .bind(anonId)
    .run();
  return c.json({ deleted: res.meta.changes ?? 0 });
});

// ────────────────────────────────────────────────────────────────────────────
// 법무 문서 redirect — 도메인 결정 후 wrangler secret 으로 주입.
//   wrangler secret put LEGAL_PRIVACY_URL  (예: https://docs.example.com/privacy)
//   wrangler secret put LEGAL_TERMS_URL
//   wrangler secret put LEGAL_SECURITY_URL
//   wrangler secret put LEGAL_LICENSE_URL
// 미설정 시 503 + 사용자 안내 + 폴백으로 GitHub repo 의 raw 마크다운 시도.
// ────────────────────────────────────────────────────────────────────────────

const LEGAL_FALLBACK_PATH: Record<string, string> = {
  privacy: "docs/legal/privacy-policy.md",
  terms: "docs/legal/terms.md",
  security: "SECURITY.md",
  license: "LICENSE",
};

app.get("/legal/:kind", (c) => {
  const kind = c.req.param("kind");
  const envKey = `LEGAL_${kind.toUpperCase()}_URL` as keyof Bindings;
  const configured = c.env[envKey] as string | undefined;
  if (configured) {
    return c.redirect(configured, 302);
  }
  // 폴백: GitHub repo 의 raw 마크다운으로 redirect (운영자가 GH_OWNER/GH_REPO 설정한 경우).
  const fallback = LEGAL_FALLBACK_PATH[kind];
  if (fallback && c.env.GH_OWNER && c.env.GH_REPO) {
    return c.redirect(
      `https://github.com/${c.env.GH_OWNER}/${c.env.GH_REPO}/blob/main/${fallback}`,
      302,
    );
  }
  return c.json(
    {
      error: "legal document URL not configured",
      kind,
      hint: `Set ${String(envKey)} via wrangler secret, or configure GH_OWNER/GH_REPO for GitHub fallback.`,
    },
    503,
  );
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
 * 사용자 OS별 다운로드 진입점.
 *   /download/win, /download/mac, /download/mac-arm, /download/mac-intel, /download/linux
 * GitHub Releases 자산 URL로 302 redirect.
 */
app.get("/download/:platform", async (c) => {
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

/** GitHub Actions release 직후 캐시 무효화. Bearer 토큰 필요. */
app.post("/admin/purge", async (c) => {
  const auth = c.req.header("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!c.env.PURGE_TOKEN || token !== c.env.PURGE_TOKEN) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const body = await c.req.json().catch(() => ({}));
  const key = (body as { key?: string }).key ?? "gh:latest-release";
  if (c.env.CACHE) {
    await c.env.CACHE.delete(key);
  }
  return c.json({ purged: key });
});

export default app;

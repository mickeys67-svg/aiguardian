import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({ origin: "*", allowHeaders: ["content-type"] }));

app.get("/health", (c) =>
  c.json({ ok: true, service: "tg-backend", version: "0.1.0" }),
);

// 레시피 메타 — Recipe Engine 가 부팅 시 캐시.
app.get("/recipes", async (c) => {
  if (!c.env.DB) {
    // 로컬 dev: D1 binding 없으면 빈 배열.
    return c.json({ recipes: [] });
  }
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

// 텔레메트리 — v0.9 §4.5 옵트인.
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

// 에러 패턴 — AI Roundtripper 가 로컬 DB miss 시 백엔드 조회.
app.get("/error-patterns", async (c) => {
  if (!c.env.DB) return c.json({ patterns: [] });
  const { results } = await c.env.DB.prepare(
    "SELECT id, pattern, lang, solution, frequency FROM error_patterns ORDER BY frequency DESC LIMIT 200",
  ).all();
  return c.json({ patterns: results });
});

export default app;

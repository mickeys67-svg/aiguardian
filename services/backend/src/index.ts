import { Hono } from "hono";

// Cloudflare Workers + D1. Week 4 부터 레시피 메타 응답.

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/health", (c) => c.json({ ok: true, service: "tg-backend", version: "0.1.0" }));

app.get("/recipes", async (c) => {
  // Week 4: D1 쿼리. 지금은 빈 배열.
  return c.json({ recipes: [] });
});

app.post("/telemetry", async (c) => {
  // PostHog 프록시 또는 자체 수집. v0.9 §4.5 옵트인.
  return c.json({ accepted: true });
});

export default app;

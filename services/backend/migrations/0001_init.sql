-- v0.9 §4.4 데이터 모델 — 백엔드 D1 측 엔티티.
-- 로컬 SQLite (rusqlite) 측은 apps/desktop/src-tauri/src/storage/mod.rs 에 별도.

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    est_minutes INTEGER NOT NULL,
    description TEXT NOT NULL,
    outcome TEXT NOT NULL,
    requires TEXT NOT NULL,         -- JSON array
    prompt_template TEXT NOT NULL,
    steps TEXT NOT NULL,            -- JSON array
    featured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recipes_featured ON recipes (featured DESC, est_minutes ASC);

CREATE TABLE IF NOT EXISTS telemetry_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    anon_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    app_version TEXT,
    props TEXT,                     -- JSON
    received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_telemetry_event ON telemetry_events (event, timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_anon ON telemetry_events (anon_id);

CREATE TABLE IF NOT EXISTS error_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL,          -- regex 또는 literal substring
    lang TEXT NOT NULL DEFAULT 'all',
    solution TEXT NOT NULL,         -- 한국어 해결 가이드
    frequency INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_error_patterns_freq ON error_patterns (frequency DESC);

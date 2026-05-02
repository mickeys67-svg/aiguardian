-- Google OAuth + 세션 + 다운로드 트래킹 (v0.2.1).
-- 정식 서비스 진입 — 익명 다운로드 → 로그인 필수 다운로드 전환.
--
-- ⚠ 멱등성 주의:
--   SQLite 는 ALTER TABLE ADD COLUMN IF NOT EXISTS 미지원.
--   재실행 시 "duplicate column" 에러로 깨짐.
--   안전판:
--     - 운영: wrangler d1 migrations apply 가 이름 단위 추적 → 자동 1회만 실행
--     - 로컬 개발: 이 마이그레이션을 다시 돌리려면 D1 DB 자체를 재생성하거나
--                  ALTER 줄을 일시 주석 처리 후 재실행
--     - 향후 컬럼 추가 마이그레이션은 별도 파일 (0005_xxx.sql) 로 분리

-- 기존 users 확장 (SQLite 는 ALTER TABLE ADD COLUMN 만 지원).
ALTER TABLE users ADD COLUMN google_sub TEXT;
ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN picture TEXT;
ALTER TABLE users ADD COLUMN last_login_at TEXT;
ALTER TABLE users ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0;

-- google_sub 로 빠른 lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users (google_sub);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- 세션 — JWT 안 쓰고 D1 기반 (revoke 가능, 디버그 쉬움).
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    user_agent TEXT,
    ip TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

-- 다운로드 로그 — 누가 언제 무엇을 받았는지.
CREATE TABLE IF NOT EXISTS downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    version TEXT,
    user_agent TEXT,
    downloaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_downloads_user ON downloads (user_id, downloaded_at DESC);

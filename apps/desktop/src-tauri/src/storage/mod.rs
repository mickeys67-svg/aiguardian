// 로컬 SQLite — v0.9 §4.4 Environment 캐시 + LearnedTerm + ProjectStep.
// Week 2: Environment 캐시만. 24h TTL.

use anyhow::Result;
use once_cell::sync::OnceCell;
use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::Mutex;

static DB: OnceCell<Mutex<Connection>> = OnceCell::new();

fn db_path() -> Result<PathBuf> {
    let dir = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .or_else(dirs::home_dir)
        .ok_or_else(|| anyhow::anyhow!("no data dir"))?
        .join("tg");
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("tg.db"))
}

pub fn init() -> Result<()> {
    let path = db_path()?;
    let conn = Connection::open(path)?;
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS environment_cache (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            payload TEXT NOT NULL,
            scanned_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS learned_term (
            term TEXT PRIMARY KEY,
            context TEXT,
            first_seen_at TEXT NOT NULL,
            mastered INTEGER NOT NULL DEFAULT 0
        );
        "#,
    )?;
    DB.set(Mutex::new(conn))
        .map_err(|_| anyhow::anyhow!("DB already initialized"))?;
    Ok(())
}

pub fn with_db<R>(f: impl FnOnce(&Connection) -> Result<R>) -> Result<R> {
    let mutex = DB.get().ok_or_else(|| anyhow::anyhow!("DB not initialized"))?;
    let guard = mutex
        .lock()
        .map_err(|_| anyhow::anyhow!("DB mutex poisoned"))?;
    f(&guard)
}

pub fn read_environment_cache() -> Result<Option<(String, String)>> {
    with_db(|conn| {
        let row = conn
            .query_row(
                "SELECT payload, scanned_at FROM environment_cache WHERE id = 1",
                [],
                |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
            )
            .ok();
        Ok(row)
    })
}

pub fn write_environment_cache(payload: &str, scanned_at: &str) -> Result<()> {
    with_db(|conn| {
        conn.execute(
            "INSERT INTO environment_cache (id, payload, scanned_at)
             VALUES (1, ?1, ?2)
             ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, scanned_at = excluded.scanned_at",
            params![payload, scanned_at],
        )?;
        Ok(())
    })
}

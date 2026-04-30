// Learning System — v0.9 §4.2 #7
// 사용자가 본 명령어·도구·개념을 누적해 졸업 진행도 산출.
// Week 4: 기록만. Week 5~6 에서 카드 + 게이지 UI.

use anyhow::Result;
use chrono::Utc;
use rusqlite::params;
use serde::Serialize;

use crate::storage;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningProgress {
    pub total: i64,
    pub mastered: i64,
}

#[tauri::command]
pub fn track_term(term: String, context: Option<String>) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    storage::with_db(|conn| {
        conn.execute(
            "INSERT INTO learned_term (term, context, first_seen_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(term) DO UPDATE SET context = COALESCE(excluded.context, learned_term.context)",
            params![term, context, now],
        )?;
        Ok(())
    })
    .map_err(|e: anyhow::Error| e.to_string())
}

#[tauri::command]
pub fn learning_progress() -> Result<LearningProgress, String> {
    storage::with_db(|conn| {
        let total: i64 = conn.query_row("SELECT COUNT(*) FROM learned_term", [], |r| r.get(0))?;
        let mastered: i64 = conn.query_row(
            "SELECT COUNT(*) FROM learned_term WHERE mastered = 1",
            [],
            |r| r.get(0),
        )?;
        Ok(LearningProgress { total, mastered })
    })
    .map_err(|e: anyhow::Error| e.to_string())
}

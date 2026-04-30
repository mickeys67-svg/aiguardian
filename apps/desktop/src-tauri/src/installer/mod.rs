// Tool Installer 모듈 — Week 3 본격 구현 예정
//
// 책임 (v0.9 §4.2 모듈 #2):
// - Mac: Homebrew 래퍼 (`brew install python@3.12 node git`)
// - Win: winget 래퍼
// - 권한 다이얼로그 처리 (sudo / UAC)
// - 진행 표시 + 학습 카드 노출 시점 노출
// - 실패 재시도 + 대안 경로 (Homebrew 부재 시 공식 dmg)
//
// Week 1 단계에서는 시그니처만.

use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallStep {
    pub tool: String,
    pub status: InstallStatus,
    pub log_tail: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InstallStatus {
    Queued,
    Running,
    Succeeded,
    Failed,
}

#[allow(dead_code)]
pub async fn install(_tool: &str) -> anyhow::Result<InstallStep> {
    anyhow::bail!("not yet implemented (Week 3)")
}

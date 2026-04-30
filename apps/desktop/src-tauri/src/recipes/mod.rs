// Recipe Engine — v0.9 §4.2 #4
// Week 4: 첫 레시피만 번들로 포함. v1.0 부터 백엔드(D1)에서 받음.

use crate::safety;
use serde::{Deserialize, Serialize};

// 20개 레시피 한 곳에 모음. 폴더별 recipe.json 은 v1.0 사용자 기여 시스템용으로 보존.
const BUNDLED_INDEX: &str = include_str!("../../../../../recipes/index.json");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeStep {
    pub id: String,
    pub title: String,
    pub description: String,
    /// Unix(macOS/Linux)에서 실행할 명령
    #[serde(default)]
    pub command: Option<String>,
    /// Windows에서 실행할 명령 (cmd 호환). 없으면 command 사용.
    #[serde(default)]
    pub windows_command: Option<String>,
    #[serde(default)]
    pub optional: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recipe {
    pub id: String,
    pub title: String,
    pub category: String,
    pub difficulty: String,
    pub est_minutes: u32,
    pub description: String,
    pub outcome: String,
    pub requires: Vec<String>,
    pub prompt_template: String,
    pub steps: Vec<RecipeStep>,
    #[serde(default)]
    pub featured: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StepRunResult {
    pub step_id: String,
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub blocked: bool,
}

#[tauri::command]
pub fn list_recipes() -> Result<Vec<Recipe>, String> {
    serde_json::from_str(BUNDLED_INDEX).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn run_recipe_step(
    step_id: String,
    command: String,
    windows_command: Option<String>,
    dry: Option<bool>,
) -> Result<StepRunResult, String> {
    // OS 적합한 명령 선택
    let effective = if cfg!(target_os = "windows") {
        windows_command.unwrap_or_else(|| command.clone())
    } else {
        command.clone()
    };

    if safety::is_blacklisted(&effective) {
        return Ok(StepRunResult {
            step_id,
            success: false,
            stdout: String::new(),
            stderr: "이 명령은 차단됐어요. 더 안전한 방법으로 도와드릴게요.".into(),
            blocked: true,
        });
    }

    if dry.unwrap_or(false) {
        return Ok(StepRunResult {
            step_id,
            success: true,
            stdout: format!("(dry-run) 실행 예정: {effective}"),
            stderr: String::new(),
            blocked: false,
        });
    }

    // OS 별 셸 호출.
    // Windows: raw_arg 로 Rust 의 자동 quoting 우회 — cmd /S /C "전체 명령" 형태로
    //          내부 따옴표가 그대로 보존되어야 'if not exist "X" mkdir "X"' 가 동작.
    let output = run_shell(&effective).map_err(|e| format!("실행 실패: {e}"))?;

    Ok(StepRunResult {
        step_id,
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        blocked: false,
    })
}

#[cfg(target_os = "windows")]
fn run_shell(command: &str) -> std::io::Result<std::process::Output> {
    use std::os::windows::process::CommandExt;
    let mut cmd = std::process::Command::new("cmd");
    // /S 가 외부 따옴표 한 쌍만 strip 하므로 명령 전체를 따옴표로 감싸 안전.
    cmd.raw_arg(format!("/S /C \"{command}\""));
    cmd.output()
}

#[cfg(not(target_os = "windows"))]
fn run_shell(command: &str) -> std::io::Result<std::process::Output> {
    std::process::Command::new("/bin/sh")
        .arg("-c")
        .arg(command)
        .output()
}

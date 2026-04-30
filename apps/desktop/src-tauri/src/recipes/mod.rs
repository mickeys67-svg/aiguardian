// Recipe Engine — v0.9 §4.2 #4
// Week 4: 첫 레시피만 번들로 포함. v1.0 부터 백엔드(D1)에서 받음.

use crate::safety;
use serde::{Deserialize, Serialize};

const BUNDLED_WEBPAGE: &str = include_str!("../../../../../recipes/01-simple-webpage/recipe.json");
const BUNDLED_DISCORD: &str = include_str!("../../../../../recipes/02-discord-bot/recipe.json");
const BUNDLED_PHOTO: &str = include_str!("../../../../../recipes/06-photo-resize/recipe.json");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeStep {
    pub id: String,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub command: Option<String>,
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
    let mut out = Vec::with_capacity(3);
    for json in [BUNDLED_WEBPAGE, BUNDLED_DISCORD, BUNDLED_PHOTO] {
        let r: Recipe = serde_json::from_str(json).map_err(|e| e.to_string())?;
        out.push(r);
    }
    Ok(out)
}

#[tauri::command]
pub fn run_recipe_step(
    step_id: String,
    command: String,
    dry: Option<bool>,
) -> Result<StepRunResult, String> {
    if safety::is_blacklisted(&command) {
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
            stdout: format!("(dry-run) 실행 예정: {command}"),
            stderr: String::new(),
            blocked: false,
        });
    }

    let (program, args) = if cfg!(target_os = "windows") {
        ("cmd", vec!["/C".to_string(), command.clone()])
    } else {
        ("/bin/sh", vec!["-c".to_string(), command.clone()])
    };

    let output = std::process::Command::new(program)
        .args(&args)
        .output()
        .map_err(|e| format!("실행 실패: {e}"))?;

    Ok(StepRunResult {
        step_id,
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        blocked: false,
    })
}

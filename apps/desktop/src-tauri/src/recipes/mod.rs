// Recipe Engine — v0.9 §4.2 #4
// Week 4: 첫 레시피만 번들로 포함. v1.0 부터 백엔드(D1)에서 받음.

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

// 레시피는 읽기전용 데이터(list_recipes)로만 제공한다. 앱이 명령을 대신 실행하지
// 않는다(ADR-0004) — 옛 run_recipe_step/run_shell(셸 실행) 은 제거됨.
#[tauri::command]
pub fn list_recipes() -> Result<Vec<Recipe>, String> {
    serde_json::from_str(BUNDLED_INDEX).map_err(|e| e.to_string())
}

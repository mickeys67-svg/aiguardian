use crate::storage;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

const CACHE_TTL_HOURS: i64 = 24;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolStatus {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    /// 입문자용 한 줄 설명 (v0.9 §부록 A)
    pub friendly_description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiClientStatus {
    pub name: String,
    pub installed: bool,
    /// MCP 연결 가능 여부 (config 파일 존재 + 쓰기 가능)
    pub mcp_ready: bool,
    pub config_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Environment {
    pub os: String,
    pub shell: Option<String>,
    pub runtimes: Vec<ToolStatus>,
    pub package_managers: Vec<ToolStatus>,
    pub ai_clients: Vec<AiClientStatus>,
    pub last_scanned: String,
    pub cached: bool,
}

#[tauri::command]
pub fn inspect_environment(force: Option<bool>) -> Result<Environment, String> {
    let force = force.unwrap_or(false);

    if !force {
        if let Ok(Some((payload, scanned_at))) = storage::read_environment_cache() {
            if let (Ok(env), Ok(ts)) = (
                serde_json::from_str::<Environment>(&payload),
                DateTime::parse_from_rfc3339(&scanned_at),
            ) {
                let age = Utc::now().signed_duration_since(ts.with_timezone(&Utc));
                if age < Duration::hours(CACHE_TTL_HOURS) {
                    return Ok(Environment {
                        cached: true,
                        ..env
                    });
                }
            }
        }
    }

    let env = scan_now();
    if let Ok(payload) = serde_json::to_string(&env) {
        let _ = storage::write_environment_cache(&payload, &env.last_scanned);
    }
    Ok(env)
}

fn scan_now() -> Environment {
    let os = if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    }
    .to_string();

    let shell = std::env::var("SHELL")
        .ok()
        .or_else(|| std::env::var("ComSpec").ok());

    let runtimes = vec![
        tool(
            "python3",
            "코드를 실행하는 엔진. 데이터·자동화에 자주 써요.",
        ),
        tool("node", "JavaScript 코드를 실행하는 엔진. 웹·봇에 써요."),
        tool("git", "코드 변경 기록 도구. 거의 모든 개발의 기본이에요."),
    ];

    let package_managers = if cfg!(target_os = "macos") {
        vec![tool(
            "brew",
            "Mac에서 프로그램들을 한 줄로 깔게 해주는 도구.",
        )]
    } else if cfg!(target_os = "windows") {
        vec![tool(
            "winget",
            "Windows에서 프로그램들을 한 줄로 깔게 해주는 도구.",
        )]
    } else {
        vec![]
    };

    let ai_clients = vec![
        detect_ai_client(
            "claude_desktop",
            &claude_desktop_app_paths(),
            claude_desktop_config(),
        ),
        detect_ai_client(
            "claude_code",
            &claude_code_app_paths(),
            claude_code_config(),
        ),
        detect_ai_client("cursor", &cursor_app_paths(), cursor_config()),
    ];

    Environment {
        os,
        shell,
        runtimes,
        package_managers,
        ai_clients,
        last_scanned: Utc::now().to_rfc3339(),
        cached: false,
    }
}

fn tool(name: &str, friendly: &str) -> ToolStatus {
    let version = which_version(name);
    ToolStatus {
        name: name.to_string(),
        installed: version.is_some(),
        version,
        friendly_description: friendly.to_string(),
    }
}

fn which_version(cmd: &str) -> Option<String> {
    let output = Command::new(cmd).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        Some(String::from_utf8_lossy(&output.stderr).trim().to_string()).filter(|s| !s.is_empty())
    } else {
        Some(text)
    }
}

fn home() -> Option<PathBuf> {
    dirs::home_dir()
}

/// 설치 여부는 앱 실행 파일/번들 경로로, MCP 준비는 config 파일 쓰기 가능 여부로 분리.
fn detect_ai_client(
    name: &str,
    app_paths: &[PathBuf],
    config_path: Option<PathBuf>,
) -> AiClientStatus {
    let installed = app_paths.iter().any(|p| p.exists());

    // MCP ready: config 파일이 이미 존재하거나, 부모 디렉토리가 존재해서 우리가 쓸 수 있음.
    let mcp_ready = config_path
        .as_ref()
        .map(|p| p.exists() || p.parent().map(|parent| parent.exists()).unwrap_or(false))
        .unwrap_or(false);

    AiClientStatus {
        name: name.to_string(),
        installed,
        mcp_ready: installed && mcp_ready,
        config_path: config_path.map(|p| p.to_string_lossy().to_string()),
    }
}

fn claude_desktop_app_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(h) = home() {
        if cfg!(target_os = "macos") {
            paths.push(PathBuf::from("/Applications/Claude.app"));
            paths.push(h.join("Applications/Claude.app"));
            paths.push(h.join("Library/Application Support/Claude"));
        } else if cfg!(target_os = "windows") {
            paths.push(h.join("AppData/Local/AnthropicClaude/Claude.exe"));
            paths.push(h.join("AppData/Local/Programs/Claude/Claude.exe"));
            paths.push(h.join("AppData/Roaming/Claude"));
        }
    }
    paths
}

fn claude_desktop_config() -> Option<PathBuf> {
    let h = home()?;
    if cfg!(target_os = "macos") {
        Some(h.join("Library/Application Support/Claude/claude_desktop_config.json"))
    } else if cfg!(target_os = "windows") {
        Some(h.join("AppData/Roaming/Claude/claude_desktop_config.json"))
    } else {
        None
    }
}

fn claude_code_app_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(h) = home() {
        // Claude Code 는 CLI. 설치되면 ~/.claude/ 디렉토리 또는 PATH 의 claude 바이너리.
        paths.push(h.join(".claude"));
    }
    if let Some(claude) = which("claude") {
        paths.push(claude);
    }
    paths
}

fn claude_code_config() -> Option<PathBuf> {
    home().map(|h| h.join(".claude/settings.json"))
}

fn cursor_app_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(h) = home() {
        if cfg!(target_os = "macos") {
            paths.push(PathBuf::from("/Applications/Cursor.app"));
            paths.push(h.join("Applications/Cursor.app"));
        } else if cfg!(target_os = "windows") {
            paths.push(h.join("AppData/Local/Programs/cursor/Cursor.exe"));
            paths.push(h.join("AppData/Local/cursor/Cursor.exe"));
        }
    }
    if let Some(cursor) = which("cursor") {
        paths.push(cursor);
    }
    paths
}

fn cursor_config() -> Option<PathBuf> {
    home().map(|h| h.join(".cursor/mcp.json"))
}

/// PATH 에서 명령 찾기 (which/where 호출 없이 직접 lookup)
fn which(cmd: &str) -> Option<PathBuf> {
    let exts: &[&str] = if cfg!(target_os = "windows") {
        &[".exe", ".cmd", ".bat", ""]
    } else {
        &[""]
    };
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        for ext in exts {
            let candidate = dir.join(format!("{cmd}{ext}"));
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

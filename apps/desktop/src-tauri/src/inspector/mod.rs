use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Environment {
    pub os: &'static str,
    pub shell: Option<String>,
    pub runtimes: HashMap<String, Option<String>>,
    pub ai_clients: HashMap<String, bool>,
    pub last_scanned: String,
}

#[tauri::command]
pub fn inspect_environment() -> Result<Environment, String> {
    let os = if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    };

    let shell = std::env::var("SHELL").ok();

    let mut runtimes = HashMap::new();
    for tool in ["python3", "node", "git", "brew", "winget"] {
        runtimes.insert(tool.to_string(), which_version(tool));
    }

    let mut ai_clients = HashMap::new();
    ai_clients.insert("claude_desktop".into(), claude_desktop_installed());
    ai_clients.insert("claude_code".into(), config_exists(".claude"));
    ai_clients.insert("cursor".into(), config_exists(".cursor"));

    Ok(Environment {
        os,
        shell,
        runtimes,
        ai_clients,
        last_scanned: chrono_like_now(),
    })
}

fn which_version(cmd: &str) -> Option<String> {
    let output = Command::new(cmd).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn home() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

fn config_exists(rel: &str) -> bool {
    home().map(|h| h.join(rel).exists()).unwrap_or(false)
}

fn claude_desktop_installed() -> bool {
    if let Some(h) = home() {
        if cfg!(target_os = "macos") {
            return h
                .join("Library/Application Support/Claude/claude_desktop_config.json")
                .exists();
        }
        if cfg!(target_os = "windows") {
            return h
                .join("AppData/Roaming/Claude/claude_desktop_config.json")
                .exists();
        }
    }
    false
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("epoch:{secs}")
}

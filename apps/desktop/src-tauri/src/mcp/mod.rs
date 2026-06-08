// MCP Integrator — v0.9 §4.2 #3
// Claude Desktop · Claude Code · Cursor 3종 어댑터.
//
// 각 클라이언트의 config 파일에 TG MCP 서버 항목을 추가하거나 검증한다.
// 파일은 atomic write (temp + rename)로 작성, 백업은 .bak 확장자로 보존.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

const TG_SERVER_KEY: &str = "tg";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
    pub client: String,
    pub config_path: String,
    pub registered: bool,
    pub backup_path: Option<String>,
}

#[derive(Debug, Clone, Copy)]
pub enum McpClient {
    ClaudeDesktop,
    ClaudeCode,
    Cursor,
}

impl McpClient {
    pub fn from_name(name: &str) -> Option<Self> {
        match name {
            "claude_desktop" => Some(Self::ClaudeDesktop),
            "claude_code" => Some(Self::ClaudeCode),
            "cursor" => Some(Self::Cursor),
            _ => None,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Self::ClaudeDesktop => "claude_desktop",
            Self::ClaudeCode => "claude_code",
            Self::Cursor => "cursor",
        }
    }

    fn config_path(self) -> Option<PathBuf> {
        let h = dirs::home_dir()?;
        match self {
            Self::ClaudeDesktop => {
                if cfg!(target_os = "macos") {
                    Some(h.join("Library/Application Support/Claude/claude_desktop_config.json"))
                } else if cfg!(target_os = "windows") {
                    Some(h.join("AppData/Roaming/Claude/claude_desktop_config.json"))
                } else {
                    None
                }
            }
            Self::ClaudeCode => Some(h.join(".claude/settings.json")),
            Self::Cursor => Some(h.join(".cursor/mcp.json")),
        }
    }
}

#[tauri::command]
pub fn register_mcp(
    client: String,
    server_command: Option<String>,
    server_args: Option<Vec<String>>,
) -> Result<McpStatus, String> {
    let c =
        McpClient::from_name(&client).ok_or_else(|| format!("알 수 없는 클라이언트: {client}"))?;
    let path = c
        .config_path()
        .ok_or_else(|| "이 OS에서는 지원되지 않는 클라이언트예요.".to_string())?;

    let (cmd, args) = match (server_command, server_args) {
        (Some(c), Some(a)) => (c, a),
        _ => default_mcp_invocation()?,
    };

    register(c, &path, &cmd, &args).map_err(|e| e.to_string())
}

/// dev 환경에서 workspace root 의 packages/mcp-server/dist/cli.js 자동 탐지.
fn default_mcp_invocation() -> Result<(String, Vec<String>), String> {
    let start = std::env::current_dir().map_err(|e| format!("작업 디렉토리를 못 찾았어요: {e}"))?;
    let cli = find_mcp_cli(&start).ok_or_else(|| {
        "MCP 서버 빌드를 못 찾았어요. 'pnpm --filter @tg/mcp-server build' 한 번 실행 후 다시 연결해주세요.".to_string()
    })?;
    Ok(("node".to_string(), vec![cli.to_string_lossy().to_string()]))
}

fn find_mcp_cli(start: &Path) -> Option<PathBuf> {
    let mut current = Some(start.to_path_buf());
    while let Some(dir) = current {
        let candidate = dir.join("packages/mcp-server/dist/cli.js");
        if candidate.exists() {
            return Some(candidate);
        }
        current = dir.parent().map(|p| p.to_path_buf());
    }
    None
}

#[tauri::command]
pub fn check_mcp(client: String) -> Result<McpStatus, String> {
    let c =
        McpClient::from_name(&client).ok_or_else(|| format!("알 수 없는 클라이언트: {client}"))?;
    let path = c
        .config_path()
        .ok_or_else(|| "이 OS에서는 지원되지 않는 클라이언트예요.".to_string())?;

    let registered = if path.exists() {
        match fs::read_to_string(&path) {
            Ok(text) => contains_tg_server(&text),
            Err(_) => false,
        }
    } else {
        false
    };

    Ok(McpStatus {
        client: c.name().to_string(),
        config_path: path.to_string_lossy().to_string(),
        registered,
        backup_path: None,
    })
}

fn contains_tg_server(text: &str) -> bool {
    serde_json::from_str::<Value>(text)
        .ok()
        .and_then(|v| {
            v.get("mcpServers")
                .and_then(|m| m.get(TG_SERVER_KEY))
                .map(|_| true)
        })
        .unwrap_or(false)
}

fn register(
    client: McpClient,
    path: &Path,
    server_command: &str,
    server_args: &[String],
) -> Result<McpStatus> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("부모 폴더 생성 실패: {parent:?}"))?;
    }

    let mut root: Value = if path.exists() {
        let text = fs::read_to_string(path).with_context(|| format!("읽기 실패: {path:?}"))?;
        serde_json::from_str(&text).unwrap_or_else(|_| json!({}))
    } else {
        json!({})
    };

    let backup_path = if path.exists() {
        let bak = path.with_extension("json.bak");
        let _ = fs::copy(path, &bak);
        Some(bak.to_string_lossy().to_string())
    } else {
        None
    };

    let servers = root
        .as_object_mut()
        .ok_or_else(|| anyhow::anyhow!("config root가 객체가 아님"))?
        .entry("mcpServers".to_string())
        .or_insert_with(|| json!({}));

    let map = servers
        .as_object_mut()
        .ok_or_else(|| anyhow::anyhow!("mcpServers 가 객체가 아님"))?;

    map.insert(
        TG_SERVER_KEY.to_string(),
        json!({
            "command": server_command,
            "args": server_args,
        }),
    );

    let pretty = serde_json::to_string_pretty(&root)?;
    atomic_write(path, &pretty)?;

    Ok(McpStatus {
        client: client.name().to_string(),
        config_path: path.to_string_lossy().to_string(),
        registered: true,
        backup_path,
    })
}

fn atomic_write(path: &Path, content: &str) -> Result<()> {
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, content)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

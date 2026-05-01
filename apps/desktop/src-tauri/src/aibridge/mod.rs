// AI Bridge 자동 모드 — `claude -p "<prompt>"` 비대화 호출.
// 입문자가 복사·붙여넣기 왕복 없이 한 클릭으로 코드를 받게 해줌.

use serde::Serialize;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudePrintResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub command_used: String,
    /// `claude` 실행 파일을 찾지 못했을 때 true. 프론트가 폴백 안내에 사용.
    pub claude_missing: bool,
}

/// `claude -p "<prompt>"` 를 실행해 stdout 을 그대로 반환.
/// 60초 타임아웃 (입문자 안내용).
///
/// 안전: prompt 는 std::process 가 인자로 안전하게 전달.
/// 셸을 거치지 않으므로 인젝션 위험 없음.
#[tauri::command]
pub async fn run_claude_print(prompt: String) -> Result<ClaudePrintResult, String> {
    let prompt_clone = prompt.clone();

    // 블로킹 호출이라 spawn_blocking 으로 분리.
    let handle = tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new("claude");
        cmd.arg("-p").arg(&prompt_clone);

        // Windows 에선 새 콘솔 창 안 뜨게.
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let started = std::time::Instant::now();
        let output = cmd.output();

        match output {
            Ok(o) => Ok(ClaudePrintResult {
                success: o.status.success(),
                stdout: String::from_utf8_lossy(&o.stdout).to_string(),
                stderr: String::from_utf8_lossy(&o.stderr).to_string(),
                command_used: "claude -p".to_string(),
                claude_missing: false,
            }),
            Err(e) => {
                // ENOENT = 실행파일 없음.
                let missing = e.kind() == std::io::ErrorKind::NotFound;
                let elapsed = started.elapsed();
                Ok(ClaudePrintResult {
                    success: false,
                    stdout: String::new(),
                    stderr: format!(
                        "{e} (경과: {:.1}s){}",
                        elapsed.as_secs_f32(),
                        if missing {
                            " — claude 명령을 찾지 못했어요. 깔려있나 확인해주세요."
                        } else {
                            ""
                        }
                    ),
                    command_used: "claude -p".to_string(),
                    claude_missing: missing,
                })
            }
        }
    });

    // 60초 안에 끝나야 입문자가 답답하지 않음.
    match tokio::time::timeout(Duration::from_secs(60), handle).await {
        Ok(Ok(r)) => r,
        Ok(Err(e)) => Err(format!("Claude 호출 중 오류: {e}")),
        Err(_) => Ok(ClaudePrintResult {
            success: false,
            stdout: String::new(),
            stderr: "60초가 넘어가서 멈췄어요. 다시 시도하거나 수동 모드로 가주세요.".to_string(),
            command_used: "claude -p".to_string(),
            claude_missing: false,
        }),
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureFolderResult {
    pub path: String,
    pub created: bool,
    pub already_existed: bool,
}

fn expand_home(input: &str) -> Result<PathBuf, String> {
    if let Some(rest) = input.strip_prefix("~/").or_else(|| input.strip_prefix("~\\")) {
        let home = dirs::home_dir().ok_or_else(|| "홈 디렉토리를 찾지 못했어요.".to_string())?;
        Ok(home.join(rest))
    } else if input == "~" {
        dirs::home_dir().ok_or_else(|| "홈 디렉토리를 찾지 못했어요.".to_string())
    } else {
        Ok(PathBuf::from(input))
    }
}

/// 절대 경로로 변환 — ~ 확장 + 정규화. shell.open 이 ~ 못 풀어주는 문제 해결용.
#[tauri::command]
pub fn resolve_path(path: String) -> Result<String, String> {
    let resolved = expand_home(&path)?;
    Ok(resolved.to_string_lossy().to_string())
}

/// 시스템 기본 핸들러로 폴더 (또는 파일) 열기. ~ 자동 확장.
/// Windows: explorer.exe 사용 — &/^/% 같은 cmd 메타문자 안전.
#[tauri::command]
pub fn open_in_system(path: String) -> Result<(), String> {
    let resolved = expand_home(&path)?;
    if !resolved.exists() {
        return Err(format!("경로가 없어요: {}", resolved.display()));
    }

    #[cfg(windows)]
    {
        // explorer.exe 는 인자 escape 없이 OsStr 전달 — cmd /c 보다 안전.
        Command::new("explorer.exe")
            .arg(&resolved)
            .spawn()
            .map_err(|e| format!("열기 실패: {e}"))?;
        return Ok(());
    }

    #[cfg(not(windows))]
    let resolved_str = resolved.to_string_lossy().to_string();

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&resolved_str)
            .spawn()
            .map_err(|e| format!("열기 실패: {e}"))?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&resolved_str)
            .spawn()
            .map_err(|e| format!("열기 실패: {e}"))?;
        Ok(())
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallClaudeResult {
    pub success: bool,
    pub method: String,
    pub stdout: String,
    pub stderr: String,
}

/// Claude Code 설치 시도. Windows: winget, mac: brew, linux: 가이드.
/// 시도 실패 시 success=false 반환 — 호출자가 설치 페이지로 보냄.
#[tauri::command]
pub async fn install_claude_code() -> Result<InstallClaudeResult, String> {
    #[cfg(windows)]
    {
        // winget install Anthropic.ClaudeCode (또는 npm i -g)
        let out = tokio::task::spawn_blocking(|| {
            Command::new("winget")
                .args([
                    "install",
                    "--id",
                    "Anthropic.ClaudeCode",
                    "--accept-source-agreements",
                    "--accept-package-agreements",
                    "--silent",
                ])
                .output()
        })
        .await
        .map_err(|e| format!("작업 시작 실패: {e}"))?;
        match out {
            Ok(o) => {
                let stdout = String::from_utf8_lossy(&o.stdout).to_string();
                let stderr = String::from_utf8_lossy(&o.stderr).to_string();
                let success = o.status.success();
                if success {
                    return Ok(InstallClaudeResult {
                        success: true,
                        method: "winget".to_string(),
                        stdout,
                        stderr,
                    });
                }
                // winget 실패 — npm 시도.
                let npm_out = tokio::task::spawn_blocking(|| {
                    Command::new("npm")
                        .args(["install", "-g", "@anthropic-ai/claude-code"])
                        .output()
                })
                .await
                .map_err(|e| format!("npm 시작 실패: {e}"))?;
                if let Ok(no) = npm_out {
                    if no.status.success() {
                        return Ok(InstallClaudeResult {
                            success: true,
                            method: "npm".to_string(),
                            stdout: String::from_utf8_lossy(&no.stdout).to_string(),
                            stderr: String::from_utf8_lossy(&no.stderr).to_string(),
                        });
                    }
                }
                Ok(InstallClaudeResult {
                    success: false,
                    method: "winget+npm".to_string(),
                    stdout,
                    stderr,
                })
            }
            Err(e) => Ok(InstallClaudeResult {
                success: false,
                method: "winget".to_string(),
                stdout: String::new(),
                stderr: format!("winget 실행 실패: {e}"),
            }),
        }
    }

    #[cfg(target_os = "macos")]
    {
        let out = tokio::task::spawn_blocking(|| {
            Command::new("npm")
                .args(["install", "-g", "@anthropic-ai/claude-code"])
                .output()
        })
        .await
        .map_err(|e| format!("작업 시작 실패: {e}"))?;
        match out {
            Ok(o) => Ok(InstallClaudeResult {
                success: o.status.success(),
                method: "npm".to_string(),
                stdout: String::from_utf8_lossy(&o.stdout).to_string(),
                stderr: String::from_utf8_lossy(&o.stderr).to_string(),
            }),
            Err(e) => Ok(InstallClaudeResult {
                success: false,
                method: "npm".to_string(),
                stdout: String::new(),
                stderr: format!("npm 실행 실패: {e}"),
            }),
        }
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let out = tokio::task::spawn_blocking(|| {
            Command::new("npm")
                .args(["install", "-g", "@anthropic-ai/claude-code"])
                .output()
        })
        .await
        .map_err(|e| format!("작업 시작 실패: {e}"))?;
        match out {
            Ok(o) => Ok(InstallClaudeResult {
                success: o.status.success(),
                method: "npm".to_string(),
                stdout: String::from_utf8_lossy(&o.stdout).to_string(),
                stderr: String::from_utf8_lossy(&o.stderr).to_string(),
            }),
            Err(e) => Ok(InstallClaudeResult {
                success: false,
                method: "npm".to_string(),
                stdout: String::new(),
                stderr: format!("npm 실행 실패: {e}"),
            }),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactFile {
    pub name: String,
    pub size_bytes: u64,
    pub kind: String, // "image" | "data" | "doc" | "code" | "other"
}

/// 폴더 안 결과 파일 나열 — VerifyHint(data) 가 사용. 홈 디렉토리 안쪽만.
#[tauri::command]
pub fn list_artifact_files(folder_path: String) -> Result<Vec<ArtifactFile>, String> {
    let resolved = expand_home(&folder_path)?;
    let home = dirs::home_dir().ok_or("홈 디렉토리 없음")?;
    let canonical = resolved
        .canonicalize()
        .map_err(|e| format!("폴더 접근 실패: {e}"))?;
    if !canonical.starts_with(&home) {
        return Err("안전을 위해 홈 디렉토리 안쪽만 가능해요.".to_string());
    }

    let mut files: Vec<ArtifactFile> = Vec::new();
    let entries = std::fs::read_dir(&canonical)
        .map_err(|e| format!("폴더 읽기 실패: {e}"))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        // 숨김 파일·session.md 같은 가디언 메타는 제외.
        if name.starts_with('.') || name == "session.md" {
            continue;
        }
        let meta = std::fs::metadata(&path).ok();
        let size_bytes = meta.map(|m| m.len()).unwrap_or(0);
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_ascii_lowercase())
            .unwrap_or_default();
        let kind = match ext.as_str() {
            "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" => "image",
            "csv" | "tsv" | "xlsx" | "xls" | "json" | "xml" | "yml" | "yaml" => "data",
            "pdf" | "docx" | "doc" | "txt" | "md" | "rtf" => "doc",
            "py" | "js" | "ts" | "html" | "css" | "rs" | "go" | "java" => "code",
            _ => "other",
        };
        files.push(ArtifactFile {
            name,
            size_bytes,
            kind: kind.to_string(),
        });
    }
    // 가나다 정렬.
    files.sort_by(|a, b| a.name.cmp(&b.name));
    // 최대 50개 (UI 폭주 방지).
    files.truncate(50);
    Ok(files)
}

// 정적 서버 정지 시그널 — 한 번에 하나만 동작.
static SHARE_RUNNING: once_cell::sync::Lazy<Arc<AtomicBool>> =
    once_cell::sync::Lazy::new(|| Arc::new(AtomicBool::new(false)));

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServeArtifactResult {
    pub url: String,
    pub port: u16,
    pub local_ip: String,
}

fn detect_local_ip() -> String {
    // UDP socket 트릭 — 외부로 안 나가지만 OS 가 routing 결정 → local ip 반환.
    use std::net::UdpSocket;
    if let Ok(s) = UdpSocket::bind("0.0.0.0:0") {
        if s.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = s.local_addr() {
                return addr.ip().to_string();
            }
        }
    }
    "127.0.0.1".to_string()
}

fn read_request_line(stream: &mut TcpStream) -> Option<String> {
    let mut buf = [0u8; 1024];
    let n = stream.read(&mut buf).ok()?;
    let s = String::from_utf8_lossy(&buf[..n]);
    s.lines().next().map(|x| x.to_string())
}

/// 친구한테 보여주기 — 임시 정적 서버 시작. 같은 와이파이 폰에서 접속 가능.
/// path = artifact 파일 경로 (~/projects/.../index.html). 부모 폴더가 docroot.
#[tauri::command]
pub fn serve_artifact(path: String) -> Result<ServeArtifactResult, String> {
    let resolved = expand_home(&path)?;
    if !resolved.exists() {
        return Err(format!("파일이 없어요: {}", resolved.display()));
    }
    let docroot = resolved
        .parent()
        .ok_or("부모 폴더가 없어요")?
        .to_path_buf();
    let entry_name = resolved
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "index.html".to_string());

    // 이전 서버 정지 시그널.
    SHARE_RUNNING.store(false, Ordering::SeqCst);
    thread::sleep(Duration::from_millis(150));

    // 0.0.0.0:0 — 빈 포트 자동 할당.
    let listener = TcpListener::bind("0.0.0.0:0")
        .map_err(|e| format!("포트 바인딩 실패: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("포트 조회 실패: {e}"))?
        .port();
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("non-block 실패: {e}"))?;

    let local_ip = detect_local_ip();
    let url = format!("http://{}:{}/", local_ip, port);

    SHARE_RUNNING.store(true, Ordering::SeqCst);
    let running = SHARE_RUNNING.clone();

    thread::spawn(move || {
        let mut idle = 0u32;
        for stream in listener.incoming() {
            if !running.load(Ordering::SeqCst) {
                break;
            }
            match stream {
                Ok(mut s) => {
                    let docroot = docroot.clone();
                    let entry_name = entry_name.clone();
                    thread::spawn(move || {
                        let req = read_request_line(&mut s).unwrap_or_default();
                        // GET /path HTTP/1.1
                        let req_path = req
                            .split_whitespace()
                            .nth(1)
                            .unwrap_or("/")
                            .to_string();
                        let clean = req_path.split('?').next().unwrap_or("/").to_string();
                        let rel = if clean == "/" || clean.is_empty() {
                            entry_name.clone()
                        } else {
                            clean.trim_start_matches('/').to_string()
                        };
                        // 안전: ".." 거부.
                        if rel.contains("..") {
                            let _ = s.write_all(
                                b"HTTP/1.1 403 Forbidden\r\nContent-Length: 9\r\n\r\nForbidden",
                            );
                            return;
                        }
                        let target = docroot.join(&rel);
                        if !target.starts_with(&docroot) {
                            let _ = s.write_all(
                                b"HTTP/1.1 403 Forbidden\r\nContent-Length: 9\r\n\r\nForbidden",
                            );
                            return;
                        }
                        match std::fs::read(&target) {
                            Ok(bytes) => {
                                let mime = match target.extension().and_then(|e| e.to_str()) {
                                    Some("html") | Some("htm") => "text/html; charset=utf-8",
                                    Some("css") => "text/css; charset=utf-8",
                                    Some("js") => "application/javascript; charset=utf-8",
                                    Some("json") => "application/json; charset=utf-8",
                                    Some("png") => "image/png",
                                    Some("jpg") | Some("jpeg") => "image/jpeg",
                                    Some("svg") => "image/svg+xml",
                                    Some("gif") => "image/gif",
                                    _ => "application/octet-stream",
                                };
                                let header = format!(
                                    "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n",
                                    mime,
                                    bytes.len()
                                );
                                let _ = s.write_all(header.as_bytes());
                                let _ = s.write_all(&bytes);
                            }
                            Err(_) => {
                                let _ = s.write_all(
                                    b"HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\n\r\nNot found",
                                );
                            }
                        }
                    });
                    idle = 0;
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(50));
                    idle += 1;
                    // 10분 idle 후 자동 종료.
                    if idle > 12000 {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    Ok(ServeArtifactResult {
        url,
        port,
        local_ip,
    })
}

#[tauri::command]
pub fn stop_serve_artifact() -> Result<(), String> {
    SHARE_RUNNING.store(false, Ordering::SeqCst);
    Ok(())
}

/// 작업 폴더 보장 — 없으면 만들고, 있으면 그대로. 홈 디렉토리 안쪽만 허용.
#[tauri::command]
pub fn ensure_folder(path: String) -> Result<EnsureFolderResult, String> {
    let resolved = expand_home(&path)?;
    let home = dirs::home_dir().ok_or_else(|| "홈 디렉토리 없음".to_string())?;
    // 안전: 홈 안쪽만.
    // canonicalize 가 아직 없는 폴더에선 실패하므로 부모 거슬러 검사.
    let mut probe = resolved.clone();
    while !probe.exists() {
        match probe.parent() {
            Some(p) if p != probe => probe = p.to_path_buf(),
            _ => break,
        }
    }
    let canonical = probe.canonicalize().unwrap_or(probe);
    if !canonical.starts_with(&home) {
        return Err(format!(
            "안전을 위해 홈 디렉토리({}) 안에서만 폴더를 만들 수 있어요.",
            home.display()
        ));
    }

    let already = resolved.exists();
    if !already {
        std::fs::create_dir_all(&resolved).map_err(|e| format!("폴더 생성 실패: {e}"))?;
    }

    Ok(EnsureFolderResult {
        path: resolved.to_string_lossy().to_string(),
        created: !already,
        already_existed: already,
    })
}

/// 지정한 폴더에서 PowerShell/Terminal 열기. Windows 우선, mac/linux fallback.
/// `with_command` 가 Some 이면 폴더 진입 후 자동 실행 (예: "claude").
#[tauri::command]
pub fn open_terminal_in(path: String, with_command: Option<String>) -> Result<(), String> {
    let resolved = expand_home(&path)?;
    if !resolved.exists() {
        return Err(format!("폴더가 없어요: {}", resolved.display()));
    }
    let folder_str = resolved.to_string_lossy().to_string();

    #[cfg(windows)]
    {
        // PowerShell single-quoted literal — escape '' 한 후 중첩 문자열 안전.
        let escape_pwsh = |s: &str| s.replace('\'', "''");
        let folder_q = escape_pwsh(&folder_str);
        let cmd = match with_command {
            Some(c) => format!(
                "Set-Location -LiteralPath '{}' ; {}",
                folder_q,
                escape_pwsh(&c)
            ),
            None => format!("Set-Location -LiteralPath '{}'", folder_q),
        };
        // powershell.exe 직접 실행 — cmd /c start 의 인자 파싱 우회.
        Command::new("powershell.exe")
            .args(["-NoExit", "-Command", &cmd])
            .spawn()
            .map_err(|e| format!("PowerShell 실행 실패: {e}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let script = if let Some(c) = with_command {
            format!(
                "tell application \"Terminal\" to do script \"cd '{}' && {}\"",
                folder_str.replace('\'', "'\\''"),
                c
            )
        } else {
            format!(
                "tell application \"Terminal\" to do script \"cd '{}'\"",
                folder_str.replace('\'', "'\\''")
            )
        };
        Command::new("osascript")
            .args(["-e", &script])
            .spawn()
            .map_err(|e| format!("Terminal 실행 실패: {e}"))?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        // Linux: GNOME Terminal 우선, fallback xterm.
        let cmd_str = with_command
            .map(|c| format!("cd '{}' && {} ; bash", folder_str, c))
            .unwrap_or_else(|| format!("cd '{}' ; bash", folder_str));
        Command::new("gnome-terminal")
            .args(["--", "bash", "-c", &cmd_str])
            .spawn()
            .or_else(|_| {
                Command::new("xterm")
                    .args(["-e", &cmd_str])
                    .spawn()
            })
            .map_err(|e| format!("터미널 실행 실패: {e}"))?;
        Ok(())
    }
}

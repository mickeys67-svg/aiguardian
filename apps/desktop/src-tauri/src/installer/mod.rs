// Tool Installer 모듈 — v0.9 §4.2 #2
//
// Week 3 책임:
// - Mac: Homebrew 래퍼
// - Win: winget 래퍼
// - 진행 표시 (이벤트 emit)
// - 실패 재시도 + 대안 경로

use crate::safety;
use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub tool: String,
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub command_used: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DryRun {
    pub command: String,
    pub explanation: String,
    pub blocked: bool,
    pub block_reason: Option<String>,
}

/// 명령을 실행하지 않고 입문자에게 보여줄 설명만 반환.
/// v0.9 §3.4 실행 직전 검증형 팁의 데이터 소스.
#[tauri::command]
pub fn dry_run(command: String) -> Result<DryRun, String> {
    let blocked = safety::is_blacklisted(&command);
    Ok(DryRun {
        explanation: explain(&command),
        block_reason: blocked.then(|| {
            "이 명령은 시스템을 망가뜨릴 수 있어 차단됐어요. 다른 방법으로 도와드릴게요."
                .to_string()
        }),
        blocked,
        command,
    })
}

#[tauri::command]
pub async fn install_tool(tool: String) -> Result<InstallResult, String> {
    let (cmd, args) = if cfg!(target_os = "macos") {
        ("brew", vec!["install".to_string(), brew_formula(&tool)])
    } else if cfg!(target_os = "windows") {
        (
            "winget",
            vec![
                "install".to_string(),
                "--silent".to_string(),
                "--accept-source-agreements".to_string(),
                "--accept-package-agreements".to_string(),
                winget_id(&tool),
            ],
        )
    } else {
        return Err("Linux는 v0.1 범위 밖이에요.".into());
    };

    let command_used = format!("{cmd} {}", args.join(" "));
    if safety::is_blacklisted(&command_used) {
        return Err("Safety Net에 의해 차단됐어요.".into());
    }

    let output = Command::new(cmd)
        .args(&args)
        .output()
        .map_err(|e| format!("실행 실패: {e}"))?;

    Ok(InstallResult {
        tool,
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        command_used,
    })
}

fn brew_formula(tool: &str) -> String {
    match tool {
        "python3" => "python@3.12".into(),
        other => other.into(),
    }
}

fn winget_id(tool: &str) -> String {
    match tool {
        "python3" => "Python.Python.3.12".into(),
        "node" => "OpenJS.NodeJS.LTS".into(),
        "git" => "Git.Git".into(),
        other => other.into(),
    }
}

fn explain(command: &str) -> String {
    let normalized = command.trim();
    if normalized.starts_with("brew install") {
        return "Mac의 패키지 매니저로 도구 하나를 깔아요. 안전해요.".into();
    }
    if normalized.starts_with("winget install") {
        return "Windows 패키지 매니저로 도구 하나를 깔아요. 안전해요.".into();
    }
    if normalized.starts_with("git ") {
        return "코드 변경 기록 명령이에요. 파일 내용을 망가뜨리지 않아요.".into();
    }
    if normalized.starts_with("mkdir") {
        return "새 폴더를 만드는 명령이에요. 기존 파일에는 영향 없어요.".into();
    }
    if normalized.starts_with("cd ") {
        return "폴더를 이동하는 명령이에요. 아무것도 바꾸지 않아요.".into();
    }
    if normalized.starts_with("npm ") || normalized.starts_with("pnpm ") {
        return "JavaScript 도구의 명령이에요. 프로젝트 폴더 안에서만 작동해요.".into();
    }
    "이 명령이 처음 보이면 ⓘ 버튼으로 더 자세히 볼 수 있어요.".into()
}

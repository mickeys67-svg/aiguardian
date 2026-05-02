// 파일 IO — 입문자용 안전 래퍼.
//
// `cat > file` 같은 stdin 대기 명령을 대체. 레시피의 write_file 단계가 호출.
// path 검증: 사용자 home 안쪽 경로만 허용 (절대 시스템 영역 못 건드림).

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileWriteResult {
    pub path: String,
    pub bytes: usize,
}

fn resolve_safe_path(input: &str) -> Result<PathBuf, String> {
    // ~ 확장
    let expanded = if let Some(rest) = input.strip_prefix("~/").or_else(|| input.strip_prefix("~\\")) {
        let home = dirs::home_dir().ok_or_else(|| "홈 디렉토리를 찾지 못했어요.".to_string())?;
        home.join(rest)
    } else if input == "~" {
        dirs::home_dir().ok_or_else(|| "홈 디렉토리를 찾지 못했어요.".to_string())?
    } else {
        PathBuf::from(input)
    };

    let home = dirs::home_dir().ok_or_else(|| "홈 디렉토리를 찾지 못했어요.".to_string())?;
    let canonical_parent = canonical_or_root(expanded.parent().unwrap_or(Path::new(".")), &home)?;

    if !canonical_parent.starts_with(&home) {
        return Err(format!(
            "안전을 위해 홈 디렉토리({}) 안에서만 작업할 수 있어요.",
            home.display()
        ));
    }

    Ok(canonical_parent.join(
        expanded
            .file_name()
            .ok_or_else(|| "파일 이름이 비어있어요.".to_string())?,
    ))
}

fn canonical_or_root(p: &Path, home: &Path) -> Result<PathBuf, String> {
    if p.exists() {
        p.canonicalize().map_err(|e| e.to_string())
    } else {
        // 부모를 거슬러 올라가며 존재하는 첫 조상의 canonical + 나머지.
        let mut current = p.to_path_buf();
        let mut tail: Vec<std::ffi::OsString> = Vec::new();
        while !current.exists() {
            if let Some(name) = current.file_name() {
                tail.push(name.to_os_string());
            }
            match current.parent() {
                Some(parent) if parent != current => current = parent.to_path_buf(),
                _ => return Ok(home.to_path_buf()),
            }
        }
        let mut resolved = current.canonicalize().map_err(|e| e.to_string())?;
        for part in tail.into_iter().rev() {
            resolved.push(part);
        }
        Ok(resolved)
    }
}

#[tauri::command]
pub fn write_file(path: String, contents: String) -> Result<FileWriteResult, String> {
    let resolved = resolve_safe_path(&path)?;
    if let Some(parent) = resolved.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("폴더 생성 실패: {e}"))?;
    }
    let bytes = contents.as_bytes().len();
    fs::write(&resolved, contents).map_err(|e| format!("파일 쓰기 실패: {e}"))?;
    Ok(FileWriteResult {
        path: resolved.to_string_lossy().to_string(),
        bytes,
    })
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    let resolved = resolve_safe_path(&path)?;
    let bytes = fs::read(&resolved).map_err(|e| format!("파일 읽기 실패: {e}"))?;
    // BOM 제거 — Windows 메모장 등이 UTF-8 파일에 BOM (EF BB BF) 추가하는 경우.
    // BOM 이 남으면 JSON parse / regex / 첫 문자 비교 등에서 미세한 버그 유발.
    let content = strip_bom(&bytes);
    String::from_utf8(content)
        .map_err(|e| format!("파일이 UTF-8 이 아니에요: {e}"))
}

/// UTF-8 / UTF-16 BE / UTF-16 LE BOM 제거.
fn strip_bom(bytes: &[u8]) -> Vec<u8> {
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        // UTF-8 BOM
        bytes[3..].to_vec()
    } else if bytes.starts_with(&[0xFE, 0xFF]) {
        // UTF-16 BE BOM — Tauri Web 영역에서 처리 어려우니 거부 (드뭄)
        bytes.to_vec()
    } else if bytes.starts_with(&[0xFF, 0xFE]) {
        // UTF-16 LE BOM
        bytes.to_vec()
    } else {
        bytes.to_vec()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_outside_home() {
        let err = resolve_safe_path("/etc/passwd").unwrap_err();
        assert!(err.contains("홈 디렉토리"));
    }
}

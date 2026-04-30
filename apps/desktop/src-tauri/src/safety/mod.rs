// Safety Net 모듈 — Week 3~5 단계적 구현
//
// 책임 (v0.9 §4.2 모듈 #6):
// - 위험 명령 블랙리스트 차단
// - dry-run 미리보기
// - 시스템 복원 지점 자동 생성 (v0.9 §4.5 보안 모델)
// - Undo 큐
//
// Week 1: 블랙리스트 시그니처만 정의.

const BLACKLIST_PATTERNS: &[&str] = &[
    "rm -rf /",
    "rm -rf /*",
    "rm -rf ~",
    ":(){:|:&};:",
    "mkfs",
    "dd if=",
    "> /dev/sda",
    "format c:",
    "del /f /s /q c:\\",
    "chmod -R 000",
];

pub fn is_blacklisted(command: &str) -> bool {
    let normalized = command.to_lowercase();
    BLACKLIST_PATTERNS
        .iter()
        .any(|p| normalized.contains(&p.to_lowercase()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_obvious_destructive_commands() {
        assert!(is_blacklisted("sudo rm -rf /"));
        assert!(is_blacklisted("RM -RF /"));
        assert!(is_blacklisted("mkfs.ext4 /dev/sda1"));
        assert!(is_blacklisted("format C:"));
    }

    #[test]
    fn allows_normal_commands() {
        assert!(!is_blacklisted("brew install python@3.12"));
        assert!(!is_blacklisted("git status"));
        assert!(!is_blacklisted("npm install"));
    }
}

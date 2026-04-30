// Tauri 측 safety::is_blacklisted 와 동일한 패턴. Rust 와 TS 양쪽에서 검증.
const PATTERNS = [
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
] as const;

export function isBlacklisted(command: string): boolean {
  const normalized = command.toLowerCase();
  return PATTERNS.some((p) => normalized.includes(p.toLowerCase()));
}

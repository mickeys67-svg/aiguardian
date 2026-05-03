# SBOM (Software Bill of Materials) 생성 — CycloneDX 형식.
# EU CRA(Cyber Resilience Act, 2024/2847) 사전 정렬 — 의존성 투명성 확보.
#
# 산출물:
#   sbom/sbom-rust.cdx.json   — Tauri 백엔드 (Rust crates)
#   sbom/sbom-node.cdx.json   — pnpm workspace (Node 패키지)
#   sbom/sbom-merged.cdx.json — 두 SBOM 병합 (선택, 필요 시)
#
# 사용:
#   .\scripts\generate-sbom.ps1
#   .\scripts\generate-sbom.ps1 -SkipInstall   # 도구가 이미 깔린 경우

[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [string]$OutDir = "sbom"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}

Write-Host "==> 1/2  Rust SBOM (apps/desktop/src-tauri)" -ForegroundColor Cyan

if (-not $SkipInstall) {
    if (-not (Get-Command "cargo-cyclonedx" -ErrorAction SilentlyContinue)) {
        Write-Host "    cargo-cyclonedx 미설치 — 설치 중..."
        cargo install --locked cargo-cyclonedx
        if ($LASTEXITCODE -ne 0) { throw "cargo-cyclonedx 설치 실패" }
    }
}

Push-Location apps/desktop/src-tauri
try {
    cargo cyclonedx --format json --override-filename "$repoRoot/$OutDir/sbom-rust.cdx"
    if ($LASTEXITCODE -ne 0) { throw "cargo cyclonedx 실패" }
} finally {
    Pop-Location
}

Write-Host "==> 2/2  Node SBOM (pnpm workspace)" -ForegroundColor Cyan

# pnpm 자체엔 CycloneDX 산출이 없으므로 @cyclonedx/cyclonedx-npm 사용.
# pnpm-lock.yaml 을 직접 읽지 못하므로 node_modules 기반으로 동작 — pnpm install 선행 필요.
if (-not (Test-Path "node_modules")) {
    Write-Host "    node_modules 없음 — pnpm install 먼저 실행하세요." -ForegroundColor Yellow
    exit 1
}

pnpm dlx "@cyclonedx/cyclonedx-npm" `
    --output-format JSON `
    --output-file "$OutDir/sbom-node.cdx.json" `
    --package-lock-only=false
if ($LASTEXITCODE -ne 0) { throw "cyclonedx-npm 실패" }

Write-Host ""
Write-Host "==> 완료" -ForegroundColor Green
Get-ChildItem $OutDir | Format-Table Name, Length, LastWriteTime
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Cyan
Write-Host "  1. SBOM 결과를 GitHub Releases 자산에 첨부 (release.yml 갱신 후)"
Write-Host "  2. CVE 스캐닝: trivy sbom $OutDir/sbom-rust.cdx.json"
Write-Host "  3. 라이선스 감사: cyclonedx-cli analyze $OutDir/sbom-merged.cdx.json"

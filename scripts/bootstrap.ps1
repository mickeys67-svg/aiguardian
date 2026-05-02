# Vibemate — Windows 개발 환경 부트스트랩
#
# 사용법: 관리자 권한 PowerShell 에서
#   cd E:\aiguardian
#   .\scripts\bootstrap.ps1
#
# 멱등성: 이미 설치된 패키지는 건너뜀. 안전하게 여러 번 실행 가능.

# PowerShell 5.1+ / PowerShell 7+ 모두 호환.
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-Command {
    param([string]$Name)
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Install-WingetPackage {
    param(
        [Parameter(Mandatory)][string]$Id,
        [string]$Override = ""
    )
    $listed = winget list --id $Id --exact 2>$null | Select-String $Id
    if ($listed) {
        Write-Host "  [skip] $Id 이미 설치됨" -ForegroundColor DarkGray
        return
    }
    Write-Host "  [install] $Id"
    if ($Override) {
        winget install --id $Id --exact --silent `
            --accept-source-agreements --accept-package-agreements `
            --override $Override
    } else {
        winget install --id $Id --exact --silent `
            --accept-source-agreements --accept-package-agreements
    }
}

# 0) winget 자체 확인
if (-not (Test-Command "winget")) {
    Write-Error "winget 이 없습니다. Windows 10 1809+ 또는 Windows 11 이 필요합니다."
    exit 1
}

Write-Step "1/5 Rust toolchain (rustup + stable)"
Install-WingetPackage -Id "Rustlang.Rustup"

Write-Step "2/5 Node.js LTS"
Install-WingetPackage -Id "OpenJS.NodeJS.LTS"

Write-Step "3/5 Visual Studio Build Tools (MSVC + Windows SDK)"
Install-WingetPackage -Id "Microsoft.VisualStudio.2022.BuildTools" `
    -Override "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --add Microsoft.VisualStudio.Component.Windows11SDK.22621"

Write-Step "4/5 WebView2 런타임"
Install-WingetPackage -Id "Microsoft.EdgeWebView2"

# 5) PATH 갱신 후 rustup default stable + pnpm 글로벌 설치
Write-Step "5/5 rustup default stable + pnpm 9"

# 새로 깔린 cargo/rustup이 현재 셸에선 PATH 에 없을 수 있음. 직접 호출.
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path $cargoBin) {
    $env:Path = "$cargoBin;$env:Path"
}

if (Test-Command "rustup") {
    rustup default stable
    rustc --version
    cargo --version
} else {
    Write-Warning "rustup 을 찾을 수 없습니다. 새 PowerShell 창을 연 뒤 'rustup default stable' 을 직접 실행하세요."
}

if (Test-Command "node") {
    $nodeVer = (node --version)
    Write-Host "  node $nodeVer"
}

if (-not (Test-Command "pnpm")) {
    Write-Host "  [install] pnpm@9 via npm"
    npm install -g pnpm@9
} else {
    pnpm --version | Out-Null
    Write-Host "  pnpm $(pnpm --version)"
}

Write-Host ""
Write-Host "✅ 부트스트랩 완료." -ForegroundColor Green
Write-Host ""
Write-Host "다음 단계:"
Write-Host "  1) 새 PowerShell 창을 여세요 (PATH 갱신용)."
Write-Host "  2) cd E:\aiguardian"
Write-Host "  3) pnpm install"
Write-Host "  4) pnpm --filter @tg/desktop tauri dev"
Write-Host ""
Write-Host "첫 컴파일은 5~10분 걸립니다. 두 번째부터는 빨라요."

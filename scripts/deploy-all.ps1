# TG 배포 스크립트 — Cloudflare D1/KV/Workers/Pages + GitHub repo 일괄 셋업
#
# 처음 한 번만:
#   .\scripts\deploy-all.ps1 -GhOwner <username> -GhRepo aiguardian -Domain terminalguardian.kr
#
# 이미 설정된 상태에서 코드만 재배포:
#   .\scripts\deploy-all.ps1 -RedeployOnly
#
# 필요:
#   - gh CLI (winget install GitHub.cli) + `gh auth login` 완료
#   - wrangler (자동으로 npx 로 호출, 첫 회 `npx wrangler login`)

# PowerShell 5.1+ / PowerShell 7+ 모두 호환.
[CmdletBinding()]
param(
    [string]$GhOwner = "",
    [string]$GhRepo = "aiguardian",
    [string]$Domain = "",
    [string]$BackendName = "tg-backend",
    [string]$LandingName = "tg-landing",
    [switch]$RedeployOnly,
    [switch]$SkipGithub,
    [switch]$SkipBackend,
    [switch]$SkipLanding
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Write-Sub([string]$msg) {
    Write-Host "  $msg" -ForegroundColor DarkGray
}

function Test-Command([string]$name) {
    return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

# ─── 사전 체크 ──────────────────────────────────────────────────────────────
Write-Step "사전 도구 확인"
foreach ($cmd in @("node", "pnpm", "git")) {
    if (-not (Test-Command $cmd)) {
        Write-Error "$cmd 가 없습니다. scripts\bootstrap.ps1 을 먼저 실행하세요."
        exit 1
    }
    Write-Sub "$cmd ✓"
}

if (-not (Test-Command "gh")) {
    Write-Warning "gh CLI 가 없습니다. winget install GitHub.cli 로 설치 후 'gh auth login'."
    if (-not $SkipGithub) {
        Write-Error "GitHub repo 셋업을 건너뛰려면 -SkipGithub 사용."
        exit 1
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
Write-Sub "repo root: $repoRoot"

# ─── 1) GitHub repo ────────────────────────────────────────────────────────
if (-not $SkipGithub -and -not $RedeployOnly) {
    Write-Step "1/4 GitHub repo 생성·연결"
    if (-not $GhOwner) {
        $GhOwner = (gh api user --jq .login).Trim()
        Write-Sub "GhOwner 자동 감지: $GhOwner"
    }

    $exists = $false
    try {
        gh repo view "$GhOwner/$GhRepo" *>&1 | Out-Null
        $exists = $LASTEXITCODE -eq 0
    } catch { $exists = $false }

    if (-not $exists) {
        Write-Sub "repo 생성: $GhOwner/$GhRepo (private)"
        gh repo create "$GhOwner/$GhRepo" --private --source . --remote origin --push
    } else {
        Write-Sub "repo 이미 존재 — origin 연결만 확인"
        $remote = git remote get-url origin 2>$null
        if (-not $remote) {
            git remote add origin "https://github.com/$GhOwner/$GhRepo.git"
        }
        git push -u origin main
    }
}

# ─── 2) Cloudflare D1 + KV ─────────────────────────────────────────────────
if (-not $SkipBackend) {
    Set-Location (Join-Path $repoRoot "services\backend")

    if (-not $RedeployOnly) {
        Write-Step "2/4 Cloudflare D1 + KV 리소스 생성"

        Write-Sub "D1 database 'tg' 생성 (이미 있으면 안전 무시)"
        $d1Out = pnpm exec wrangler d1 create tg 2>&1 | Out-String
        if ($d1Out -match "database_id\s*=\s*`"([^`"]+)`"") {
            $d1Id = $matches[1]
            Write-Sub "  database_id: $d1Id"
        } else {
            $existing = pnpm exec wrangler d1 list 2>&1 | Out-String
            if ($existing -match "tg.*?([0-9a-f-]{36})") {
                $d1Id = $matches[1]
                Write-Sub "  기존 D1 사용: $d1Id"
            } else {
                Write-Warning "D1 ID 자동 추출 실패. wrangler.toml 의 database_id 를 수동으로 채우세요."
            }
        }

        Write-Sub "KV namespace 'CACHE' 생성"
        $kvOut = pnpm exec wrangler kv namespace create CACHE 2>&1 | Out-String
        if ($kvOut -match "id\s*=\s*`"([^`"]+)`"") {
            $kvId = $matches[1]
            Write-Sub "  kv id: $kvId"
        } else {
            $existing = pnpm exec wrangler kv namespace list 2>&1 | Out-String
            if ($existing -match "CACHE.*?([0-9a-f]{32})") {
                $kvId = $matches[1]
                Write-Sub "  기존 KV 사용: $kvId"
            } else {
                Write-Warning "KV ID 자동 추출 실패. wrangler.toml 을 수동으로 채우세요."
            }
        }

        # wrangler.toml 갱신
        if ($d1Id -or $kvId) {
            Write-Sub "wrangler.toml 갱신"
            $toml = Get-Content -Raw -Path "wrangler.toml"

            if ($GhOwner) {
                $toml = $toml -replace 'GH_OWNER\s*=\s*"[^"]*"', "GH_OWNER = `"$GhOwner`""
            }
            if ($GhRepo) {
                $toml = $toml -replace 'GH_REPO\s*=\s*"[^"]*"', "GH_REPO = `"$GhRepo`""
            }

            if ($d1Id -and ($toml -notmatch "database_id\s*=\s*`"$d1Id`"")) {
                $toml = $toml -replace '#\s*\[\[d1_databases\]\][^#]*?#\s*database_id\s*=\s*"REPLACE_ME"',
@"
[[d1_databases]]
binding = "DB"
database_name = "tg"
database_id = "$d1Id"
"@
            }

            if ($kvId -and ($toml -notmatch "kv_namespaces.*?$kvId")) {
                $toml = $toml -replace '#\s*\[\[kv_namespaces\]\][^#]*?#\s*id\s*=\s*"REPLACE_ME"',
@"
[[kv_namespaces]]
binding = "CACHE"
id = "$kvId"
"@
            }

            Set-Content -Path "wrangler.toml" -Value $toml -NoNewline
        }

        Write-Sub "D1 마이그레이션 적용 (init + seed)"
        pnpm exec wrangler d1 execute tg --remote --file migrations/0001_init.sql
        pnpm exec wrangler d1 execute tg --remote --file migrations/0002_seed_recipes.sql

        Write-Sub "secret 등록 안내:"
        Write-Host "  pnpm exec wrangler secret put GH_TOKEN     # GitHub PAT (releases 읽기용, 선택)" -ForegroundColor Yellow
        Write-Host "  pnpm exec wrangler secret put PURGE_TOKEN  # 임의 문자열, GitHub Actions 와 동일하게" -ForegroundColor Yellow
    }

    Write-Step "3/4 Cloudflare Workers 배포 ($BackendName)"
    pnpm exec wrangler deploy
    $backendUrl = if ($Domain) { "https://api.$Domain" } else { "" }
    Write-Sub "백엔드 URL: $(if ($backendUrl) { $backendUrl } else { 'workers.dev 서브도메인 — wrangler 출력 참고' })"
}

# ─── 3) 랜딩 페이지 ─────────────────────────────────────────────────────────
if (-not $SkipLanding) {
    Set-Location (Join-Path $repoRoot "apps\landing")

    Write-Step "4/4 Cloudflare Pages 배포 ($LandingName)"
    pnpm exec wrangler pages deploy . --project-name $LandingName
    Write-Sub "랜딩 URL: pages.dev 서브도메인 (wrangler 출력 참고)"
    if ($Domain) {
        Write-Sub "Custom domain '$Domain' 연결은 Cloudflare 대시보드에서 수동 1회."
    }
}

# ─── 마무리 ─────────────────────────────────────────────────────────────────
Set-Location $repoRoot
Write-Host ""
Write-Host "✅ 배포 완료." -ForegroundColor Green
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Cyan
Write-Host "  1) GitHub Secret 설정:"
Write-Host "     gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/tg.key"
Write-Host "     gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD"
Write-Host "     gh secret set BACKEND_PURGE_URL --body `"$(if ($Domain) { "https://api.$Domain/admin/purge" } else { 'https://<your-worker>.workers.dev/admin/purge' })`""
Write-Host "     gh secret set BACKEND_PURGE_TOKEN  # PURGE_TOKEN 와 동일한 값"
Write-Host ""
Write-Host "  2) 첫 release 태그 푸시:"
Write-Host "     git tag v0.1.0"
Write-Host "     git push origin v0.1.0"
Write-Host ""
Write-Host "  3) GitHub Actions 가 빌드 → release → 백엔드 캐시 퍼지 → 랜딩에서 다운로드 가능"
Write-Host ""
Write-Host "테스트: docs/smoke-test.md 의 체크리스트를 따라가세요." -ForegroundColor Yellow

# 스모크 테스트 — 다운로드까지 풀 파이프라인

> 목적: 코드 푸시 → 자동 빌드 → 다운로드 페이지 → 설치 → 첫 부팅까지 한 번에 점검.
> 환경: Win 우선 (ADR-0002), Mac 은 GitHub Actions runner 빌드 + 로컬 다운로드 검증.

## 체크리스트 한눈에

```
[ ] 0. bootstrap.ps1 실행 (rustup + MSVC + WebView2)
[ ] 1. deploy-all.ps1 실행 (D1 + KV + Workers + Pages + GitHub repo)
[ ] 2. GitHub Secret 4종 등록 (Tauri signing + backend purge)
[ ] 3. v0.1.0 태그 푸시 → GitHub Actions 빌드 통과
[ ] 4. 백엔드 /latest 가 v0.1.0 자산 목록 반환
[ ] 5. 랜딩 페이지 다운로드 버튼이 /download/win → MSI 받음
[ ] 6. MSI 설치 → TG 창 부팅 → Welcome 화면
[ ] 7. Diagnosis → Result 카드 그리드 표시
[ ] 8. Goal → 레시피 3개 노출
[ ] 9. Confirm dry-run 통과
[ ] 10. (옵션) 실제 실행 → 에러 시 ErrorPanel + 클립보드 복사
[ ] 11. (옵션) 설치된 v0.1.0 → tag v0.1.1 push → Updater 가 알림
```

---

## 0) 개발 환경 부트스트랩

```powershell
# 관리자 PowerShell
cd E:\aiguardian
.\scripts\bootstrap.ps1
```

**검증**: 새 PowerShell 창에서

```powershell
rustc --version  # 1.77+
cargo --version
node --version   # 20+
pnpm --version   # 9+
gh --version     # GitHub CLI
```

`gh` 가 없으면: `winget install GitHub.cli` 후 `gh auth login`.

---

## 1) Cloudflare 배포

```powershell
cd E:\aiguardian

# 첫 회: wrangler 로그인 (브라우저 열림)
pnpm exec wrangler login

# 풀 배포 (D1 + KV + Workers + Pages + GitHub repo 까지)
.\scripts\deploy-all.ps1 -GhOwner <당신의-github-username> -Domain vibemate.kr
```

도메인이 없으면 `-Domain` 생략. workers.dev 서브도메인 자동 부여.

**검증**:

```powershell
# 백엔드 health
curl https://tg-backend.<your-subdomain>.workers.dev/health

# 레시피 (D1 시드 확인)
curl https://tg-backend.<your-subdomain>.workers.dev/recipes

# 랜딩 페이지 — pages.dev URL 을 브라우저로 열기
```

기대 응답:

- `/health` → `{"ok":true,"service":"tg-backend","version":"0.1.0"}`
- `/recipes` → 3개 레시피 (01-simple-webpage, 02-discord-bot, 06-photo-resize)

---

## 2) GitHub Secret 등록

Tauri Updater 시그니처 키 한 번만 생성:

```powershell
# repo root 에서
pnpm exec tauri signer generate -w "$env:USERPROFILE\.tauri\tg.key"
# 출력된 PUBLIC KEY 를 복사 → tauri.conf.json 의 plugins.updater.pubkey 에 붙여넣기
```

GitHub Secret 4개 등록:

```powershell
# Tauri 시그니처 (Updater 가 update.json 검증에 사용)
gh secret set TAURI_SIGNING_PRIVATE_KEY -b (Get-Content "$env:USERPROFILE\.tauri\tg.key" -Raw)
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD  # 키 생성 시 입력한 비번

# 백엔드 캐시 퍼지 토큰 (release 후 캐시 무효화용)
$purge = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
gh secret set BACKEND_PURGE_TOKEN -b $purge
gh secret set BACKEND_PURGE_URL -b "https://tg-backend.<your-subdomain>.workers.dev/admin/purge"

# 같은 PURGE_TOKEN 을 wrangler 에도 등록 (백엔드가 검증)
cd services\backend
$purge | pnpm exec wrangler secret put PURGE_TOKEN
cd ..\..
```

`tauri.conf.json` 의 `pubkey` 가 `REPLACE_WITH_PUBKEY_AT_WEEK_6` 그대로면 Updater 가 작동 안 함 — 위에서 생성한 public key 로 교체 필수.

---

## 3) 첫 Release 태그 푸시

```powershell
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions → "Release (Tauri)" 워크플로우가 windows-latest + macos-latest 두 잡으로 빌드.
Win은 10~15분, Mac은 15~20분 (universal universal binary 때문).

**검증**: https://github.com/`<owner>`/aiguardian/actions

자산 (release.tag = v0.1.0):
- `TG_0.1.0_x64_en-US.msi` (Windows MSI)
- `TG_0.1.0_x64-setup.exe` (Windows NSIS)
- `TG_0.1.0_x64-setup.nsis.zip` (Updater 자산)
- `TG_0.1.0_x64-setup.nsis.zip.sig` (시그니처)
- `TG_0.1.0_universal.dmg` (Mac universal)
- `TG_0.1.0_universal.app.tar.gz` + `.sig` (Mac Updater)

---

## 4) 백엔드 메타 검증

```powershell
curl https://tg-backend.<sub>.workers.dev/latest | ConvertFrom-Json
```

기대: `version: "0.1.0"`, `assets: [...]` 6~8개. 만약 503 이면:
- `wrangler.toml` 의 `GH_OWNER`/`GH_REPO` 가 실제 repo 와 일치하는지
- private repo 라면 `GH_TOKEN` secret 필요 (`gh auth token | wrangler secret put GH_TOKEN`)

KV 캐시 30분 — 직전 release 메타가 보이면 강제 퍼지:

```powershell
curl -X POST https://tg-backend.<sub>.workers.dev/admin/purge `
  -H "Authorization: Bearer $env:PURGE_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"key":"gh:latest-release"}'
```

---

## 5) 랜딩 페이지에서 다운로드

브라우저로 pages.dev URL 또는 https://vibemate.kr (도메인 연결 후) 열기.

**검증**:
- 헤더에 `v0.1.0` 표시
- 메인 CTA: "Windows용 다운로드 (.exe)" (Windows 에서 접속 시)
- CTA 클릭 → `/download/win` → 302 redirect → GitHub Releases MSI

---

## 6) MSI 설치 + 첫 부팅

다운로드한 MSI 더블클릭. Windows SmartScreen 경고 → "추가 정보" → "실행".

**검증**:
- 시작 메뉴에 "TG" 등록
- 실행 시 1100x740 창 → Welcome 화면
- "익명 사용 통계 보내기" 체크박스 노출

---

## 7~9) 온보딩 6단계 흐름

```
Welcome → "시작할게요"
  ↓
Diagnosis (스캔 ~3초, 5단계 메시지)
  ↓
Result (Python/Node/Git + AI 클라이언트 카드 그리드)
  ↓
Goal (레시피 3장)
  ↓
RecipePreview (선택한 레시피 단계 미리보기)
  ↓
Confirm (dry-run 시작)
```

**검증 포인트**:
- 스캔이 30초 안에 끝남 (cached false → true 로 전환)
- 미설치 도구는 ⚠️, 설치된 건 ✅
- 레시피 갤러리에 ⭐ "간단 웹페이지" 가 첫 카드
- dry-run 4단계 모두 ✅ 표시

---

## 10) 실제 실행 + 에러 핸들링

Confirm 화면에서 "진짜 실행할게요" 클릭. 일부러 실패시키려면:
- 첫 레시피의 `cat > index.html` 단계는 stdin 대기로 멈춤 → Ctrl+C 후 실패
- 또는 `npx wrangler pages deploy` 가 wrangler 미인증 시 실패

**검증**:
- 실패 시 ErrorPanel (노란 배경, 빨간 X 0개)
- "AI한테 자동으로 물어볼게요" 클릭 → 클립보드에 한국어 헤더 + 영문 stderr 포맷 복사
- 위로형 팁 토스트 노출

---

## 11) Updater 동작 검증 (선택)

설치된 v0.1.0 을 띄워둔 채로:

```powershell
# 사소한 변경 후 v0.1.1 태그
git commit --allow-empty -m "chore: updater test"
git tag v0.1.1
git push origin v0.1.1
```

GitHub Actions 완료 후 백엔드 캐시 자동 퍼지 (notify-backend job).

설치된 TG 앱 재시작 → Tauri Updater 가 백엔드 `/updates/windows-x86_64/0.1.0` 호출 → 새 버전 메타 받음 → 시그니처 검증 → 사용자 다이얼로그.

**검증**:
```powershell
# 백엔드가 0.1.0 → 0.1.1 업그레이드 응답 반환하는지
curl "https://tg-backend.<sub>.workers.dev/updates/windows-x86_64/0.1.0"
# 같은 버전이면 204
curl "https://tg-backend.<sub>.workers.dev/updates/windows-x86_64/0.1.1"
```

---

## 트러블슈팅

### `/latest` 가 503
- `wrangler.toml` 의 `GH_OWNER`/`GH_REPO` 가 비어있음
- private repo 인데 `GH_TOKEN` secret 미등록
- 첫 release 가 아직 없음 (workflow 통과 확인)

### 다운로드 버튼이 "곧 다운로드 가능"
- 위 `/latest` 503 이거나 CORS 차단. 브라우저 콘솔 확인.

### MSI 설치 후 앱이 안 뜸
- WebView2 미설치 (Win 10 일부) → `winget install Microsoft.EdgeWebView2`
- Defender 가 unsigned binary 격리 → 알림 영역에서 "허용"

### Updater 가 동작 안 함
- `tauri.conf.json` 의 `pubkey` 가 `REPLACE_WITH_PUBKEY_AT_WEEK_6` 그대로
- `.sig` 파일이 release 자산에 없음 (TAURI_SIGNING_PRIVATE_KEY secret 누락)
- 디버그 빌드는 Updater 비활성 (lib.rs 의 `cfg!(not(debug_assertions))`)

### Mac 빌드 실패
- universal binary 는 `aarch64-apple-darwin` + `x86_64-apple-darwin` 둘 다 필요 — release.yml 의 `targets` 라인 확인

---

## 다음 단계 (스모크 통과 후)

- [ ] Apple Developer 가입 → Mac Notarization secret 4종 release.yml 활성화
- [ ] DigiCert EV Cert → Win 코드 서명 (SmartScreen 경고 제거)
- [ ] vibemate.kr 도메인 등록 + Cloudflare DNS 연결
- [ ] PostHog 프로젝트 생성 → 백엔드 telemetry forwarder 추가 (현재는 D1 직접 저장)
- [ ] Sentry DSN → Tauri 앱 + 백엔드 양쪽 등록
- [ ] 베타 모집 카피 + 5개 채널 (노코드 카페·페북·카톡 오픈채팅) 발송

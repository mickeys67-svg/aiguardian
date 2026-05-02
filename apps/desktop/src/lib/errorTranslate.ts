// stderr / 에러 메시지를 한국어로 친절하게 번역.
// 입문자가 영문 에러 보고 멘붕하는 걸 차단.
//
// 패턴 매칭 우선순위: 더 구체적인 정규식이 위에.
// 매칭 안 되면 원문 그대로 보여줌 (toggle 로 숨김 처리).

export interface TranslatedError {
  /** 한국어 친절 설명 */
  title: string;
  /** 다음에 뭐 할지 안내 */
  fix: string;
  /** 위험도 (사용자 안심용) */
  severity: "info" | "warning" | "error";
}

interface Pattern {
  re: RegExp;
  translate: (m: RegExpMatchArray) => TranslatedError;
}

const PATTERNS: Pattern[] = [
  // 권한 부족
  {
    re: /EACCES|permission denied|access (is )?denied|Operation not permitted/i,
    translate: () => ({
      title: "🔒 권한 부족 — 시스템 폴더에 접근하려면 관리자 권한이 필요해요",
      fix: "PowerShell 우클릭 → '관리자 권한으로 실행' 후 다시 시도하세요.",
      severity: "warning",
    }),
  },
  // 파일/명령 not found — greedy 방지: 단어 단위로만 capture.
  {
    re: /ENOENT[^']*'([^']+)'/i,
    translate: (m) => ({
      title: `📂 파일/폴더 없음 — '${m[1]}' 를 찾을 수 없어요`,
      fix: "경로가 정확한지 확인하세요. 또는 'mkdir' 로 폴더부터 만드세요.",
      severity: "warning",
    }),
  },
  // ENOENT fallback (따옴표 없는 메시지)
  {
    re: /ENOENT/i,
    translate: () => ({
      title: "📂 파일/폴더를 못 찾았어요",
      fix: "경로가 정확한지 확인하세요. 또는 'mkdir' 로 폴더부터 만드세요.",
      severity: "warning",
    }),
  },
  {
    re: /command not found|is not recognized as (an? )?(internal|external|operable) command/i,
    translate: () => ({
      title: "💻 명령어 없음 — 그 도구가 PATH 에 없어요",
      fix: "도구가 깔려있는지 확인하세요. Vibemate 의 환경 진단 → ⚙️ 설정 → 환경 다시 진단을 눌러보세요.",
      severity: "warning",
    }),
  },
  // npm 관련
  {
    re: /npm.*ERR.*EACCES/i,
    translate: () => ({
      title: "🔒 npm 권한 에러 — 글로벌 설치는 관리자 권한 필요",
      fix: "PowerShell 관리자 권한으로 다시 열고 시도, 또는 npm install --prefix=./local 로 로컬 설치 시도.",
      severity: "warning",
    }),
  },
  {
    re: /npm.*ERR.*ENOTFOUND|npm.*ERR.*ETIMEDOUT/i,
    translate: () => ({
      title: "🌐 npm 네트워크 에러 — 인터넷 연결 또는 프록시 문제",
      fix: "Wi-Fi 연결 확인. 회사 네트워크면 프록시 설정 필요할 수 있어요.",
      severity: "warning",
    }),
  },
  {
    re: /npm.*ERR.*404 not found/i,
    translate: () => ({
      title: "📦 npm 패키지 없음 — 패키지명 오타 가능성",
      fix: "패키지 이름 철자 확인 또는 https://npmjs.com 에서 검색.",
      severity: "warning",
    }),
  },
  // Python 관련
  {
    re: /ModuleNotFoundError.*'?([^'"]+)'?/i,
    translate: (m) => ({
      title: `🐍 Python 모듈 없음 — '${m[1]}' 안 깔려있어요`,
      fix: `pip install ${m[1]} 로 설치하세요. venv 안에서면 venv 활성화부터 확인.`,
      severity: "warning",
    }),
  },
  {
    re: /ImportError|No module named/i,
    translate: () => ({
      title: "🐍 Python import 에러 — 필요 모듈이 없어요",
      fix: "pip install 로 깔거나, venv 활성화 안 됐는지 확인.",
      severity: "warning",
    }),
  },
  {
    re: /SyntaxError/i,
    translate: () => ({
      title: "📝 문법 오류 — 코드 어딘가에 오타가 있어요",
      fix: "에러 메시지의 줄 번호를 확인. AI 한테 '이 SyntaxError 고쳐줘' 라고 하면 빠르게 해결.",
      severity: "error",
    }),
  },
  // Git 관련
  {
    re: /not a git repository/i,
    translate: () => ({
      title: "🔧 Git 저장소가 아니에요",
      fix: "이 폴더에서 'git init' 부터 실행하세요.",
      severity: "info",
    }),
  },
  {
    re: /Could not resolve host|Failed to connect to/i,
    translate: () => ({
      title: "🌐 네트워크 연결 실패",
      fix: "Wi-Fi · LAN 연결 확인. VPN 켜져있으면 일시 끄고 시도.",
      severity: "warning",
    }),
  },
  // 디스크 / 메모리
  {
    re: /no space left on device|디스크.*가득/i,
    translate: () => ({
      title: "💾 디스크 공간 부족",
      fix: "디스크 정리 또는 다른 드라이브에 작업.",
      severity: "error",
    }),
  },
  {
    re: /out of memory|JavaScript heap out of memory/i,
    translate: () => ({
      title: "🧠 메모리 부족",
      fix: "다른 프로그램을 닫거나 컴퓨터 재시작.",
      severity: "error",
    }),
  },
  // 포트 충돌
  {
    re: /EADDRINUSE.*:(\d+)|address already in use.*:(\d+)/i,
    translate: (m) => ({
      title: `🔌 포트 ${m[1] ?? m[2]} 가 이미 사용 중`,
      fix: `다른 프로세스가 그 포트를 쓰고 있어요. 그 프로세스 끄거나 다른 포트로 변경.`,
      severity: "warning",
    }),
  },
  // Node 버전
  {
    re: /requires Node.*>=?\s*(\d+)/i,
    translate: (m) => ({
      title: `⚙️ Node 버전 부족 — v${m[1]} 이상 필요`,
      fix: "Node 최신 버전 설치 또는 nvm 으로 버전 전환.",
      severity: "warning",
    }),
  },
  // SmartScreen / 백신
  {
    re: /SmartScreen|Windows Defender|virus|백신.*차단/i,
    translate: () => ({
      title: "🛡 Windows / 백신 차단됨",
      fix: "AhnLab/V3, 알약 등 일시 중지 후 재시도. SmartScreen 은 '추가 정보 → 실행'.",
      severity: "warning",
    }),
  },
  // 한국어 Windows cmd — '명령' 인식 실패
  {
    re: /은\(는\) 내부 또는 외부 명령|이\(가\) 아닙니다/,
    translate: () => ({
      title: "💻 명령어를 못 찾았어요 (한국어 Windows)",
      fix: "도구가 깔려있는지, PATH 에 등록됐는지 확인. ⚙️ 설정 → 환경 다시 진단.",
      severity: "warning",
    }),
  },
  // 한국어 Windows — 파일 못 찾음
  {
    re: /지정된 (파일|경로)을\(를\) 찾을 수 없습니다|시스템에서 지정된 (파일|경로)/,
    translate: () => ({
      title: "📂 그 파일/폴더를 못 찾았어요",
      fix: "경로가 정확한지 확인하세요. 또는 'mkdir' 로 폴더부터 만드세요.",
      severity: "warning",
    }),
  },
  // Windows npm 파일 잠김 (실행 중인 파일 덮어쓰기 시도)
  {
    re: /EPERM|EBUSY.*resource busy or locked/i,
    translate: () => ({
      title: "🔒 파일 잠김 — 누가 그 파일을 쓰고 있어요",
      fix: "관련 프로그램 (Node, IDE 등) 종료 후 재시도. 또는 컴퓨터 재시작.",
      severity: "warning",
    }),
  },
  // Python pip SSL — 회사/학교 네트워크
  {
    re: /SSL.*CERTIFICATE_VERIFY_FAILED|ssl.*certificate.*verify/i,
    translate: () => ({
      title: "🔐 SSL 인증서 검증 실패",
      fix: "회사·학교 네트워크에서 자주 발생. 다른 네트워크 (집·핫스팟) 에서 시도하거나, 관리자에게 인증서 신뢰 추가 요청.",
      severity: "warning",
    }),
  },
  // macOS Xcode CLI 미설치
  {
    re: /xcode-select.*error|Command Line Tools.*not installed/i,
    translate: () => ({
      title: "🍎 Xcode Command Line Tools 가 안 깔려있어요",
      fix: "터미널에서 'xcode-select --install' 실행 후 GUI 설치 마법사 진행.",
      severity: "warning",
    }),
  },
  // tar 압축 풀기 실패 (큰 패키지 다운로드 깨짐 등)
  {
    re: /tar:.*Error opening archive|Cannot open.*archive/i,
    translate: () => ({
      title: "📦 압축 파일 열기 실패",
      fix: "다운로드가 도중에 끊겼을 수 있어요. 다시 다운받거나 디스크 공간 확인.",
      severity: "warning",
    }),
  },
];

/** 에러 메시지를 한국어로 번역. 매칭 안 되면 null. */
export function translateError(raw: string): TranslatedError | null {
  if (!raw) return null;
  for (const p of PATTERNS) {
    const m = raw.match(p.re);
    if (m) return p.translate(m);
  }
  return null;
}

/** 패턴이 등록된 개수 — 디버그용. */
export function patternCount(): number {
  return PATTERNS.length;
}

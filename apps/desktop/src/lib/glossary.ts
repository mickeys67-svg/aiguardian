// 입문자용 용어 사전 — 모든 화면이 한 곳에서 가져다 씀.
// 첫 등장 시 ⓘ 패널로 풀이, 두 번째부터는 툴팁만.

export type GlossaryEntry = {
  /** 짧은 한 줄 풀이 — 툴팁용 */
  short: string;
  /** 무엇 / 왜 / 안전한가 — ⓘ 패널 본문 */
  what: string;
  why: string;
  safe: string;
};

export const GLOSSARY: Record<string, GlossaryEntry> = {
  Node: {
    short: "자바스크립트 코드를 컴퓨터에서 돌리는 엔진",
    what: "JavaScript를 실행하는 프로그램이에요. 브라우저 밖에서도 코드가 돌아가게 해줘요.",
    why: "당신이 만들 웹페이지·봇·도구 대부분이 이 위에서 돌아갑니다.",
    safe: "전 세계 개발자 90% 이상이 쓰는 표준 도구예요. 무료, 공식 사이트에서만 깝니다.",
  },
  Git: {
    short: "코드 저장·되돌리기 도구",
    what: "코드 변경 이력을 관리하는 도구예요. '저장'이 아니라 '체크포인트'를 만들어요.",
    why: "실수해도 이전 상태로 돌아갈 수 있고, GitHub 같은 곳에 코드를 올리려면 필요해요.",
    safe: "전 세계 표준. 당신 컴퓨터 안에서만 돌고 외부로 데이터를 자동 전송하지 않아요.",
  },
  "Claude Code": {
    short: "AI 코딩 도우미 (터미널 안에서)",
    what: "터미널 안에서 동작하는 AI 도우미예요. '이거 만들어줘' 라고 말하면 코드를 써줘요.",
    why: "Vibemate가 깔아준 빈 프로젝트에 실제 코드를 채워주는 역할이에요.",
    safe: "Anthropic 공식 도구. 당신 허락 없이 파일을 바꾸지 않아요.",
  },
  MCP: {
    short: "AI ↔ 컴퓨터를 잇는 다리",
    what: "AI가 당신 컴퓨터의 도구·파일에 안전하게 접근할 수 있게 해주는 표준 규약이에요.",
    why: "Vibemate가 AI한테 '이 사용자 환경에선 이 명령이 안전해' 라고 알려줄 수 있어요.",
    safe: "당신이 켜야 동작하고, 어떤 권한을 줄지 직접 정해요.",
  },
  "dry-run": {
    short: "실제로 하기 전에 미리 시늉",
    what: "명령어를 진짜 실행하지 않고, 실행했다면 어떻게 됐을지 미리 보는 안전 검사예요.",
    why: "위험한 명령을 사전에 잡아낼 수 있어요. Vibemate 모든 레시피는 dry-run 부터 해요.",
    safe: "100% 안전. 이 단계에서는 어떤 변화도 일어나지 않아요.",
  },
  터미널: {
    short: "컴퓨터에 글자로 명령하는 까만 창",
    what: "버튼·아이콘 대신 글자로 컴퓨터한테 부탁하는 창이에요.",
    why: "개발자들이 빠르게 작업하려고 쓰는 방식이에요. AI 코딩 도구도 여기서 동작해요.",
    safe: "글자만 입력해요. 모르는 명령은 Vibemate가 대신 입력해줘요.",
  },
  폴더: {
    short: "파일들을 모아두는 곳",
    what: "당신 컴퓨터 안의 한 칸. 파일탐색기에서 보이는 그 폴더와 같은 거예요.",
    why: "프로젝트마다 폴더 하나 — 정리되고 안 섞여요.",
    safe: "Vibemate는 '내 문서 / projects' 안에서만 새 폴더를 만들어요.",
  },
  의존성: {
    short: "이 프로젝트가 같이 필요한 도구들",
    what: "당신이 만들 앱이 동작하려면 같이 깔려야 하는 작은 도구 묶음이에요.",
    why: "예: 웹페이지 만들 때 React 라는 도구가 같이 깔려야 React 코드가 돌아가요.",
    safe: "공식 저장소(npm)에서 받아요. Vibemate가 사전에 안전 검사해요.",
  },
  npm: {
    short: "Node 도구를 깔고 관리하는 프로그램",
    what: "Node 의 '앱스토어' 같은 거예요. 도구를 한 줄로 깔고 지울 수 있어요.",
    why: "거의 모든 자바스크립트 프로젝트가 npm으로 의존성을 관리해요.",
    safe: "공식. Node를 깔면 자동으로 같이 깔려요.",
  },
  React: {
    short: "웹페이지를 조각조각 만드는 도구",
    what: "한 페이지를 작은 부품(컴포넌트)으로 나눠 만드는 도구예요.",
    why: "재사용·관리가 쉬워서 거의 모든 현대 웹사이트가 이걸로 만들어져요.",
    safe: "Meta(페이스북)에서 만든 공식 무료 도구.",
  },
  Tailwind: {
    short: "CSS를 짧게 쓰는 방식",
    what: "디자인을 짧은 클래스 이름으로 표현하는 도구예요.",
    why: "별도 CSS 파일 없이 빠르게 디자인할 수 있어요.",
    safe: "공식 무료 도구. 빌드 시점에만 동작하고 사용자 데이터를 모으지 않아요.",
  },
  PowerShell: {
    short: "Windows 의 까만 명령 창",
    what: "Windows 에 기본 깔린 '터미널' 프로그램 이름이에요. 까만 창에 글자로 명령을 내려요.",
    why: "Claude Code 같은 명령 도구는 모두 이 창에서 시작돼요.",
    safe: "Microsoft 정품. 가디언이 켜는 창은 당신 폴더에서만 동작합니다.",
  },
  shell: {
    short: "명령창 (PowerShell·cmd·bash) 의 통칭",
    what: "글자로 명령을 받는 창의 일반 이름이에요. Windows 에선 PowerShell 이 보통.",
    why: "AI 도구·개발 도구는 거의 모두 shell 안에서 돌아가요.",
    safe: "위험하지 않아요. 내가 입력한 명령만 실행됩니다.",
  },
  Python: {
    short: "데이터·자동화에 많이 쓰는 프로그래밍 언어",
    what: "1991년부터 쓰인 인기 언어. 자료 분석·자동화·AI 에서 표준.",
    why: "어떤 레시피는 Python 으로 동작해요.",
    safe: "공식 무료. python.org 에서만 받습니다.",
  },
  "Claude Desktop": {
    short: "Anthropic 이 만든 AI 채팅 데스크톱 앱",
    what: "Claude.ai 와 같지만 별도 앱으로 동작. 화면이 더 깔끔해요.",
    why: "터미널이 어려우면 이 앱에 메시지 붙여넣으면 됩니다.",
    safe: "Anthropic 공식. 회사 정보를 마음대로 보내지 않아요.",
  },
  "코드 블록": {
    short: "AI 답변 안 회색 박스 — 그게 코드예요",
    what: "AI 가 만든 코드를 따로 표시한 영역. 박스 우상단에 보통 'Copy' 버튼이 떠요.",
    why: "그 박스 안 글만 복사해서 우리 앱 박스에 붙여넣으면 끝나요.",
    safe: "일반 글이에요. 클릭만으로는 아무것도 안 일어나요.",
  },
  토큰: {
    short: "AI 가 글을 세는 단위 (≈ 글자 + 짧은 단어)",
    what: "한 메시지가 얼마나 긴지 재는 단위. 길수록 답변이 느리고 비용이 늘어요.",
    why: "오래 대화하면 토큰이 쌓여 답변이 점점 느려져요. 그래서 가끔 새 세션이 좋아요.",
    safe: "안전. 그냥 단위일 뿐.",
  },
  PATH: {
    short: "윈도우가 명령어를 찾는 폴더 목록",
    what: "PowerShell 에 명령을 치면 컴퓨터는 'PATH' 라는 목록에서 그 프로그램을 찾아요.",
    why: "PATH 에 없는 프로그램은 'is not recognized' 에러가 나요.",
    safe: "정상. 설치만 잘 끝나면 자동으로 PATH 에 들어갑니다.",
  },
  "command not found": {
    short: "그 명령어가 PATH 에 없어요",
    what: "타이프한 단어를 컴퓨터가 못 찾았을 때 뜨는 영문 에러. 보통 프로그램이 안 깔려있거나 오타.",
    why: "예를 들어 'claude' 는 안 깔려있으면 이 에러가 떠요.",
    safe: "걱정 마세요. 글자만 출력될 뿐 컴퓨터는 그대로예요.",
  },
  winget: {
    short: "Windows 의 앱 설치 명령",
    what: "Windows 10 후기·11 에 기본 깔린 앱스토어 비슷한 명령. 한 줄로 프로그램 설치 가능.",
    why: "Vibemate 의 '한 번 클릭으로 깔기' 버튼이 winget 으로 Claude Code 를 설치 시도해요.",
    safe: "Microsoft 정품. 공식 앱만 받아옵니다.",
  },
  "관리자 권한": {
    short: "컴퓨터 시스템 영역을 바꿀 수 있는 권한",
    what: "프로그램 설치·시스템 설정 변경 등에 필요한 상위 권한. PowerShell 을 '관리자로 실행' 으로 켜야 받을 수 있어요.",
    why: "winget 으로 앱 깔 때 가끔 필요해요. UAC 창이 떠요.",
    safe: "안전. UAC 가 매번 사용자 동의를 받아요.",
  },
  iframe: {
    short: "페이지 안 페이지 — 미리보기 창",
    what: "다른 HTML 을 한 페이지 안에 끼워 넣는 박스. Vibemate 가 만든 결과를 미리 보여줄 때 써요.",
    why: "앱을 안 닫고도 결과를 바로 볼 수 있어요.",
    safe: "안전. 별도 격리 환경에서 렌더됩니다.",
  },
  "Wi-Fi": {
    short: "무선 인터넷",
    what: "공유기에서 나오는 무선 신호. 스마트폰·노트북이 같은 공유기에 연결되면 같은 Wi-Fi 예요.",
    why: "친구한테 보여주기 QR 은 같은 Wi-Fi 안에서만 동작해요.",
    safe: "—",
  },
  QR: {
    short: "스마트폰 카메라로 찍는 사각형 코드",
    what: "주소·문자를 사각형 점 패턴으로 만든 거. 폰 카메라로 비추면 자동 인식.",
    why: "Vibemate 가 만든 임시 주소를 폰에 빠르게 옮길 때 써요.",
    safe: "코드 자체는 그냥 그림이에요. 인식하면 그 주소로 갑니다.",
  },
  Streamlit: {
    short: "Python 으로 데이터 대시보드를 빠르게 만드는 도구",
    what: "Python 스크립트 한 파일이 곧바로 웹 대시보드가 되는 프레임워크.",
    why: "엑셀·CSV 데이터 시각화에 인기. 배운 Python 만으로 그래프 페이지를 만들 수 있어요.",
    safe: "오픈소스. 당신 컴퓨터에서만 돌고 자동 배포 안 함.",
  },
  BotFather: {
    short: "텔레그램 봇 토큰을 발급하는 공식 봇",
    what: "텔레그램 안의 @BotFather 라는 봇. /newbot 명령으로 새 봇 만들고 토큰을 받아요.",
    why: "텔레그램 봇은 모두 BotFather 가 발급한 토큰으로 인증해요. 토큰 없이는 동작 X.",
    safe: "텔레그램 공식. 받은 토큰은 .env 파일에만 두고 절대 외부 공유 금지.",
  },
  venv: {
    short: "Python 가상환경 — 프로젝트별 라이브러리 격리",
    what: "한 컴퓨터 안에 여러 Python 프로젝트가 서로 다른 라이브러리 버전을 써도 안 충돌하게 만들어주는 폴더.",
    why: "글로벌 Python 에 모든 걸 깔면 충돌 발생. 프로젝트마다 venv 하나씩.",
    safe: "프로젝트 폴더 안에만 만들어져요. 지우면 깨끗이 사라집니다.",
  },
  dotenv: {
    short: "민감 정보 (토큰·API 키) 를 .env 파일에 두는 패턴",
    what: ".env 라는 텍스트 파일에 KEY=value 형태로 비밀 값을 적어두고 코드에서 불러옵니다.",
    why: "코드에 토큰을 직접 쓰면 GitHub 에 올릴 때 노출 위험. .env 는 git ignore 로 안전.",
    safe: ".env 파일은 절대 공유하지 마세요. .gitignore 에 자동 등록되어야 합니다.",
  },
  dist: {
    short: "빌드 결과물 폴더 — 인터넷에 올리는 진짜 파일들",
    what: "개발 중 코드 → 빌드 (`npm run build`) → dist/ 폴더에 최적화된 진짜 HTML/JS 가 생김.",
    why: "친구에게 보여주려면 dev server 가 아닌 dist 폴더 안 파일을 띄워야 안정적.",
    safe: "그냥 폴더예요. 안 쓰면 지워도 됩니다.",
  },
  build: {
    short: "코드 → 인터넷용 최적화 결과물 만들기",
    what: "`npm run build` 또는 비슷한 명령. 압축·최적화돼서 dist/ 폴더로 결과가 나옴.",
    why: "친구한테 보여주거나 인터넷에 올리려면 build 후 dist 폴더를 사용해요.",
    safe: "안전. 결과물만 만들 뿐 시스템 안 건드림.",
  },
  Vercel: {
    short: "프론트엔드 무료 배포 서비스",
    what: "GitHub 저장소를 연결하면 코드 push 만으로 자동 배포되는 클라우드.",
    why: "포트폴리오·웹앱을 인터넷에 올리는 가장 빠른 길 중 하나.",
    safe: "공식 무료 플랜 기본. 결제 안 함. 이메일 인증만.",
  },
  Cloudflare: {
    short: "전 세계 무료 CDN·서버리스 플랫폼",
    what: "Workers/Pages 무료 티어가 풍부. URL 단축기·정적 사이트·작은 백엔드 호스팅.",
    why: "Vibemate 의 일부 레시피(URL 단축기 등)는 Cloudflare Workers 사용.",
    safe: "공식. 무료 한도 충분. 카드 등록 없이 시작 가능.",
  },
  GitHub: {
    short: "코드 저장·공유 사이트 — Git 의 클라우드 버전",
    what: "전 세계 개발자가 코드를 올리고 협업하는 곳. 무료.",
    why: "Vercel/Cloudflare 같은 배포 서비스가 보통 GitHub 와 연결됨.",
    safe: "공식. 본인 저장소는 비공개로도 만들 수 있음.",
  },
  MSI: {
    short: "Windows 설치 파일 형식 (.msi)",
    what: "더블클릭하면 자동으로 깔리는 Windows 표준 설치 파일.",
    why: "Vibemate 데스크톱 앱의 정식 배포는 .msi 형태로 제공.",
    safe: "Windows 가 자동 검증. 출처가 확실하면 안전.",
  },
  EXE: {
    short: "Windows 실행 파일 (.exe)",
    what: "더블클릭으로 실행되는 Windows 프로그램 파일.",
    why: "설치 없이 바로 실행되는 도구는 .exe 단일 파일로 제공되기도.",
    safe: "출처 확실한 .exe 만 실행. 알 수 없는 .exe 는 절대 X.",
  },
  ZIP: {
    short: "여러 파일을 묶은 압축 파일 (.zip)",
    what: "여러 파일·폴더를 하나로 묶고 크기를 줄인 파일.",
    why: "친구한테 결과물 폴더를 보낼 때 ZIP 으로 묶으면 편해요.",
    safe: "안전. 압축 해제 시 안에 든 파일을 검토.",
  },
};

/** 글로서리에 등록된 단어인지 확인. */
export function isKnownTerm(term: string): boolean {
  return term in GLOSSARY;
}

/** 한 줄 풀이만 가져오기 — 툴팁용. */
export function glossaryShort(term: string): string | undefined {
  return GLOSSARY[term]?.short;
}

// 결과물 검증 안내 — Recipe.verifyKind 별로 다른 패널.
// HTML 외 결과물(봇/CLI/Python/데이터/웹서버)을 어떻게 확인하는지 입문자 친화 안내.

import { useEffect, useState } from "react";
import {
  listArtifactFiles,
  parentFolder,
  type ArtifactFile,
  type VerifyKind,
} from "@/lib/tauri";

interface Props {
  kind: VerifyKind | undefined;
  /** 작품 폴더 경로 — 안내 텍스트 안에 표시 */
  folderPath?: string;
  /** 결과 띄울 명령 — recipe.runCommand. 있으면 정확한 명령 표시. */
  runCommand?: string;
  /** 결과 접속 주소 — recipe.localUrl. 있으면 안내에 노출. */
  localUrl?: string;
  /** 레시피 ID — bot 토큰 발급 가이드 분기용 (discord/telegram/slack). */
  recipeId?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const KIND_ICON: Record<ArtifactFile["kind"], string> = {
  image: "🖼",
  data: "📊",
  doc: "📄",
  code: "💻",
  other: "📦",
};

function ResultFiles({ folderPath }: { folderPath: string }) {
  const [files, setFiles] = useState<ArtifactFile[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    const folder = folderPath.endsWith("/") || folderPath.endsWith("\\")
      ? folderPath
      : parentFolder(folderPath);
    void listArtifactFiles(folder).then((f) => {
      if (!cancelled) setFiles(f);
    });
    return () => {
      cancelled = true;
    };
  }, [folderPath]);

  if (!files || files.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl bg-bg border border-subtle/15 p-3">
      <p className="text-[11px] font-semibold text-ink mb-2">
        📁 폴더 안 결과 파일 ({files.length}개)
      </p>
      <ul className="space-y-1 max-h-40 overflow-y-auto">
        {files.map((f) => (
          <li
            key={f.name}
            className="flex items-center gap-2 text-[11px] text-ink/90"
          >
            <span aria-hidden>{KIND_ICON[f.kind]}</span>
            <span className="font-mono truncate flex-1">{f.name}</span>
            <span className="text-subtle shrink-0">{formatSize(f.sizeBytes)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VerifyHint({ kind, folderPath, runCommand, localUrl, recipeId }: Props) {
  // html 또는 미지정 — 안내 안 함 (Artifact 의 iframe 미리보기로 충분).
  if (!kind || kind === "html") return null;

  // bot 토큰 발급 가이드 — recipe.verifyKind === "bot" 인 경우에만 활성.
  // (slack-notifier 처럼 verifyKind=cli 인 ID 와의 false positive 차단)
  const isBotKind = kind === "bot";
  const isDiscord = isBotKind && !!recipeId && /discord/i.test(recipeId);
  const isTelegram = isBotKind && !!recipeId && /telegram/i.test(recipeId);
  const isSlack = isBotKind && !!recipeId && /slack/i.test(recipeId);

  const tokenSteps = isDiscord
    ? [
        "Discord 앱 → 사용자 설정 → 'Discord Developer Portal' (https://discord.com/developers/applications)",
        "'New Application' 누르고 이름 입력 → 'Bot' 탭 → 'Add Bot'",
        "'Reset Token' 눌러 봇 토큰 복사 → 폴더 안 .env 파일에 DISCORD_TOKEN=... 으로 저장",
        "'OAuth2 → URL Generator' 에서 scope 'bot' 선택 → 권한 체크 → 생성된 URL 로 봇을 서버에 초대",
      ]
    : isTelegram
      ? [
          "텔레그램 앱에서 @BotFather 검색 → /newbot 명령 → 봇 이름·핸들 입력",
          "BotFather 가 알려주는 토큰을 복사 (예: 1234567:ABCdef...)",
          "폴더 안 .env 파일에 TELEGRAM_TOKEN=... 으로 저장",
          "본인 채팅방으로 봇을 초대하거나 (/start) 명령으로 대화 시작",
        ]
      : isSlack
        ? [
            "Slack API (https://api.slack.com/apps) 에서 'Create New App' → From scratch",
            "OAuth & Permissions → Bot Token Scopes 추가 (chat:write 등)",
            "Install to Workspace 클릭 → Bot User OAuth Token 복사 (xoxb-...)",
            "폴더 안 .env 에 SLACK_TOKEN=xoxb-... 저장",
          ]
        : null;

  const blocks: Record<Exclude<VerifyKind, "html">, JSX.Element> = {
    bot: (
      <>
        {tokenSteps && (
          <Block
            icon="🔑"
            title={`먼저: ${
              isDiscord
                ? "Discord Developer Portal"
                : isTelegram
                  ? "BotFather"
                  : "Slack API"
            } 에서 봇 토큰 발급`}
            items={tokenSteps}
          />
        )}
        <Block
          icon="🤖"
          title="이제 봇 띄우기 + 동작 확인"
          items={[
            runCommand
              ? `💻 터미널 열기 → 정확한 명령: \`${runCommand}\``
              : "💻 터미널 열기 → 레시피의 마지막 step 명령을 실행",
            "터미널이 살아있는 동안만 봇이 동작 — 닫지 말 것",
            "봇이 들어간 채널에서 메시지·시간 트리거 확인",
            "예약 시간 됐는데 안 오면 → 터미널 로그 확인 → 'AI 한테 물어보기' 버튼",
          ]}
        />
        {folderPath && <ResultFiles folderPath={folderPath} />}
      </>
    ),
    cli: (
      <>
        <Block
          icon="💻"
          title={
            runCommand
              ? `명령행 도구 — 정확한 명령: \`${runCommand}\``
              : "이건 명령행 도구예요 — 터미널에서 실행"
          }
          items={[
            "💻 폴더 바의 '터미널 열기' 누르기 → 그 폴더에서 PowerShell 시작",
            runCommand && /^python/.test(runCommand)
              ? "venv 가 있다면 먼저 활성화: Windows `.venv\\Scripts\\activate`, Mac/Linux `source .venv/bin/activate`"
              : null,
            runCommand
              ? `\`${runCommand}\` 그대로 입력 + Enter`
              : "레시피 마지막 단계의 실행 명령을 그대로 입력",
            "결과는 까만 창 안에 글자로 떠요 — 브라우저에서 안 보임",
          ].filter((x): x is string => !!x)}
        />
        {folderPath && <ResultFiles folderPath={folderPath} />}
      </>
    ),
    python: (
      <>
        <Block
          icon="🐍"
          title={
            runCommand
              ? `Python 스크립트 — 정확한 명령: \`${runCommand}\``
              : "Python 스크립트예요 — `python` 명령으로 실행"
          }
          items={[
            "Python 이 깔려있는지 먼저 확인 (Result 화면에서 ✅)",
            runCommand
              ? `💻 터미널 열기 → \`${runCommand}\``
              : "💻 터미널 열기 → `python 파일이름.py`",
            "venv 가 있다면 먼저 활성화: Windows 는 `.venv\\Scripts\\activate`, Mac/Linux 는 `source .venv/bin/activate`",
            "결과가 화면에 또는 같은 폴더의 결과 파일로 나옴",
          ]}
        />
        {folderPath && <ResultFiles folderPath={folderPath} />}
      </>
    ),
    data: (
      <>
        <Block
          icon="📊"
          title={
            runCommand
              ? `데이터·리포트 — 정확한 실행 명령: \`${runCommand}\``
              : "이건 데이터/리포트예요 — 폴더에서 파일 확인"
          }
          items={[
            runCommand && /^python/.test(runCommand)
              ? "venv 가 있다면 먼저 활성화: Windows `.venv\\Scripts\\activate`, Mac/Linux `source .venv/bin/activate`"
              : null,
            runCommand
              ? `💻 터미널 열기 → \`${runCommand}\` 입력 → Enter (결과가 폴더 안 새 파일로 떨어져요)`
              : "📂 폴더 열기 누르기",
            "CSV·엑셀·PDF·이미지 등 결과 파일을 더블클릭하면 기본 앱이 열어요",
            "필요하면 친구한테 그 파일을 카톡으로 그대로 전송",
          ].filter((x): x is string => !!x)}
        />
        {folderPath && <ResultFiles folderPath={folderPath} />}
      </>
    ),
    web: (
      <>
        <Block
          icon="🌐"
          title={
            runCommand
              ? `웹 서버 — 정확한 명령: \`${runCommand}\``
              : "웹 서버예요 — 직접 띄워야 보입니다"
          }
          items={[
            runCommand
              ? `💻 터미널 열기 → \`${runCommand}\` 입력 + Enter`
              : "💻 터미널 열기 → 레시피 마지막 step 의 실행 명령",
            localUrl
              ? `브라우저에서 ${localUrl} 접속`
              : "터미널에 `Local: http://localhost:...` 줄이 뜨면 그 주소를 브라우저로",
            "끝낼 때는 터미널에서 Ctrl+C (=종료) 누르세요 — Ctrl+Shift+C 가 복사이고 Ctrl+C 는 종료",
            "친구한테 보여주려면 → 아래 '친구한테 보여주기' 섹션 안내를 따라가세요 (build 가 필요해요)",
          ]}
        />
        {folderPath && <ResultFiles folderPath={folderPath} />}
      </>
    ),
  };

  return (
    <section className="rounded-2xl bg-warning/5 border border-warning/30 p-5 mb-5">
      <p className="text-[10px] uppercase tracking-wide text-warning mb-2">
        결과 확인 방법 — 이 작품은 HTML 페이지가 아니에요
      </p>
      {blocks[kind]}
      {folderPath && (
        <p className="text-[10px] text-subtle mt-3 font-mono truncate">
          📁 {folderPath}
        </p>
      )}
    </section>
  );
}

function Block({
  icon,
  title,
  items,
}: {
  icon: string;
  title: string;
  items: string[];
}) {
  return (
    <div>
      <h3 className="font-semibold text-ink text-sm mb-2 flex items-center gap-2">
        <span aria-hidden>{icon}</span>
        {title}
      </h3>
      <ol className="text-xs text-ink/90 space-y-1 list-decimal list-inside">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ol>
    </div>
  );
}

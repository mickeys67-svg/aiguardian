import { invoke } from "@tauri-apps/api/core";
import { DEMO_DEFAULT_HTML, transformDemoHtml } from "./demo";
export { parentFolder, fileName, siblingPath } from "./paths";
import { parentFolder } from "./paths";

/** Tauri 런타임 안에서 동작 중인지 — 브라우저 dev 모드 감지용.
 *
 * Tauri 2 는 윈도우에 `__TAURI_INTERNALS__` 를 주입.
 * 단, `invoke` 가 getter 로 정의될 수 있어 typeof 검사가 환경별로 깨질 수 있음.
 * → 그냥 객체 존재 여부만 확인. invoke 가 실제로 실패하면 safeInvoke 가 폴백 처리. */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
    __TAURI_METADATA__?: unknown;
    isTauri?: unknown;
  };
  return !!(
    w.__TAURI_INTERNALS__ ||
    w.__TAURI__ ||
    w.__TAURI_METADATA__ ||
    w.isTauri ||
    /Tauri/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "")
  );
}

/** localStorage + sessionStorage 둘 다 검색 (옛 sessionStorage 데이터 호환). */
function readDemoFile(path: string): string | null {
  const key = `tg.demo.file.${path}`;
  try {
    const a = localStorage.getItem(key);
    if (a) return a;
  } catch {
    /* ignore */
  }
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Tauri 명령 호출 + 브라우저(dev)에서 fallback 받을 수 있게 래핑. */
async function safeInvoke<T>(
  cmd: string,
  args: Record<string, unknown> | undefined,
  fallback: () => Promise<T> | T,
): Promise<T> {
  if (!isTauri()) return await fallback();
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    console.warn(`[tauri] ${cmd} failed, using fallback:`, e);
    return await fallback();
  }
}

export type ToolStatus = {
  name: string;
  installed: boolean;
  version: string | null;
  friendlyDescription: string;
};

export type AiClientStatus = {
  name: "claude_desktop" | "claude_code" | "cursor";
  installed: boolean;
  mcpReady: boolean;
  configPath: string | null;
};

export type Environment = {
  os: "macos" | "windows" | "linux";
  shell: string | null;
  runtimes: ToolStatus[];
  packageManagers: ToolStatus[];
  aiClients: AiClientStatus[];
  lastScanned: string;
  cached: boolean;
};

export async function inspectEnvironment(force = false): Promise<Environment> {
  return safeInvoke<Environment>("inspect_environment", { force }, () => ({
    os: "windows",
    shell: "pwsh (데모)",
    runtimes: [
      { name: "node", installed: true, version: "v18.17.0", friendlyDescription: "JS 런타임" },
      { name: "git", installed: true, version: "2.43.0", friendlyDescription: "버전 관리 도구" },
      { name: "python3", installed: true, version: "3.12.0", friendlyDescription: "파이썬 런타임" },
    ],
    packageManagers: [
      { name: "npm", installed: true, version: "9.6.7", friendlyDescription: "Node 패키지 매니저" },
      { name: "pnpm", installed: true, version: "9.0.0", friendlyDescription: "빠른 Node 매니저" },
    ],
    aiClients: [
      { name: "claude_desktop", installed: true, mcpReady: true, configPath: "(데모) Claude Desktop config" },
      { name: "claude_code", installed: true, mcpReady: true, configPath: "(데모) Claude Code config" },
      { name: "cursor", installed: false, mcpReady: false, configPath: null },
    ],
    lastScanned: new Date().toISOString(),
    cached: false,
  }));
}

export type DryRun = {
  command: string;
  explanation: string;
  blocked: boolean;
  blockReason: string | null;
};

export async function dryRun(command: string): Promise<DryRun> {
  return safeInvoke<DryRun>("dry_run", { command }, () => ({
    command,
    explanation: "(데모) 안전 검사를 못 해요. 실제 동작은 데스크톱 앱에서.",
    blocked: false,
    blockReason: null,
  }));
}

export type InstallResult = {
  tool: string;
  success: boolean;
  stdout: string;
  stderr: string;
  commandUsed: string;
};

export async function installTool(tool: string): Promise<InstallResult> {
  return safeInvoke<InstallResult>("install_tool", { tool }, async () => {
    // 데모 모드: 1.5초 기다렸다가 가짜 성공.
    await new Promise((r) => setTimeout(r, 1500));
    return {
      tool,
      success: true,
      stdout: `(데모) ${tool} 설치 시뮬레이션 완료`,
      stderr: "",
      commandUsed: `(데모) install ${tool}`,
    };
  });
}

export type McpStatus = {
  client: "claude_desktop" | "claude_code" | "cursor";
  configPath: string;
  registered: boolean;
  backupPath: string | null;
};

export async function checkMcp(client: McpStatus["client"]): Promise<McpStatus> {
  return invoke<McpStatus>("check_mcp", { client });
}

export async function registerMcp(
  client: McpStatus["client"],
  serverCommand?: string,
  serverArgs?: string[],
): Promise<McpStatus> {
  return invoke<McpStatus>("register_mcp", {
    client,
    serverCommand: serverCommand ?? null,
    serverArgs: serverArgs ?? null,
  });
}

export type RecipeStep = {
  id: string;
  title: string;
  description: string;
  command: string | null;
  windowsCommand: string | null;
  optional: boolean;
};

/** 결과물 검증 방식 — Artifact 화면이 어떻게 보여줄지 결정. */
export type VerifyKind =
  | "html" // 기본: iframe 미리보기
  | "bot" // Discord/Slack/Telegram 봇 — 외부 채널에서 확인
  | "cli" // 명령행 도구 — 터미널 실행
  | "python" // Python 스크립트 — `python xxx.py`
  | "data" // 데이터/리포트 (CSV/엑셀/PDF) — 폴더 열어 확인
  | "web"; // Web 서버 (npm run dev 등) — localhost 안내

export type Recipe = {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  estMinutes: number;
  description: string;
  outcome: string;
  requires: string[];
  promptTemplate: string;
  steps: RecipeStep[];
  featured: boolean;
  /** 결과 검증 방식 — 미지정 시 "html" 가정. */
  verifyKind?: VerifyKind;
  /** 결과를 띄울 때 실행할 명령 — 예: "npm run dev", "streamlit run app.py", "python bot.py".
   *  지정 시 VerifyHint 가 정확한 명령을 보여줌. */
  runCommand?: string;
  /** 결과 띄우기 후 접속할 로컬 주소 — 예: "http://localhost:5173".
   *  web verifyKind 의 ShareSection 안내에 사용. */
  localUrl?: string;
};

export type StepRunResult = {
  stepId: string;
  success: boolean;
  stdout: string;
  stderr: string;
  blocked: boolean;
};

export async function listRecipes(): Promise<Recipe[]> {
  return safeInvoke<Recipe[]>("list_recipes", undefined, async () => {
    // 브라우저 dev 모드: Vite 가 정적 자산으로 서빙하는 JSON 직접 로드.
    const mod = (await import("../../../../recipes/index.json")) as unknown as {
      default: Recipe[];
    };
    return mod.default;
  });
}

export async function runRecipeStep(
  stepId: string,
  command: string,
  windowsCommand: string | null = null,
  dry = false,
): Promise<StepRunResult> {
  return safeInvoke<StepRunResult>(
    "run_recipe_step",
    { stepId, command, windowsCommand, dry },
    () => ({
      stepId,
      success: true,
      stdout: dry
        ? "(데모) 이 명령은 실행하면 안전합니다."
        : "(데모) 명령이 성공적으로 동작했어요.",
      stderr: "",
      blocked: false,
    }),
  );
}

export type LearningProgress = {
  total: number;
  mastered: number;
};

export async function trackTerm(term: string, context?: string): Promise<void> {
  await safeInvoke<null>(
    "track_term",
    { term, context: context ?? null },
    () => null,
  );
}

export async function learningProgress(): Promise<LearningProgress> {
  return safeInvoke<LearningProgress>("learning_progress", undefined, () => ({
    total: 0,
    mastered: 0,
  }));
}

export type FileWriteResult = {
  path: string;
  bytes: number;
};

export async function writeFile(
  path: string,
  contents: string,
): Promise<FileWriteResult> {
  return safeInvoke<FileWriteResult>("write_file", { path, contents }, () => {
    // 브라우저 데모: localStorage 에 가짜 저장 (탭 닫혀도 유지).
    try {
      localStorage.setItem(`tg.demo.file.${path}`, contents);
    } catch {
      /* localStorage 가득 — 무시 */
    }
    return { path, bytes: contents.length };
  });
}

export async function readFile(path: string): Promise<string> {
  return safeInvoke<string>("read_file", { path }, () => readDemoFile(path) ?? "");
}

export type ClaudePrintResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  commandUsed: string;
  claudeMissing: boolean;
};

// DEMO_DEFAULT_HTML 은 ./demo 에서 import (위 line 2).

// transformDemoHtml 은 ./demo 에서 import.

/**
 * `claude -p "<prompt>"` 호출. AiBridge 자동 모드의 핵심.
 * 브라우저 데모 모드에서는 사용자 요청 키워드 분석 → HTML 변형.
 */
export async function runClaudePrint(prompt: string): Promise<ClaudePrintResult> {
  return safeInvoke<ClaudePrintResult>("run_claude_print", { prompt }, async () => {
    await new Promise((r) => setTimeout(r, 1500));

    // prompt 에서 현재 코드 + 사용자 요청 추출 시도.
    const currentMatch = /```html\s*\n([\s\S]*?)```/.exec(prompt);
    const requestMatch = /사용자\s*요청\s*:\s*([^\n]+)/.exec(prompt);
    const currentHtml = currentMatch?.[1]?.trim() ?? "";
    const userRequest = requestMatch?.[1]?.trim() ?? "";

    let resultHtml: string;
    let intro: string;

    if (currentHtml && userRequest) {
      // 이터레이션: 현재 코드 변형.
      resultHtml = transformDemoHtml(currentHtml, userRequest);
      intro = `(데모 모드) "${userRequest}" 부탁대로 바꿔봤어요. 변화를 적용해보세요:`;
    } else {
      // 첫 빌드: 기본 템플릿.
      resultHtml = DEMO_DEFAULT_HTML;
      intro = "(데모 모드) 입문자용 자기소개 페이지 만들어드릴게요:";
    }

    return {
      success: true,
      stdout: `${intro}\n\n\`\`\`html\n${resultHtml}\n\`\`\`\n\n이 코드를 적용하면 끝나요.`,
      stderr: "",
      commandUsed: "(데모) claude -p",
      claudeMissing: false,
    };
  });
}

export type OpenResult =
  | "ok"
  | "no-content"
  | "popup-blocked"
  | "no-path"
  | "error";

/**
 * 브라우저 데모: 동기 함수 — 클릭 핸들러에서 직접 호출해야 팝업 차단 안 당함.
 * await 뒤에 window.open 호출하면 사용자 제스처 컨텍스트가 끊겨 차단됨.
 */
export function openArtifactInBrowser(path: string): OpenResult {
  if (!path) return "no-path";
  try {
    const contents = readDemoFile(path);
    if (!contents) return "no-content";
    const isHtml =
      path.endsWith(".html") || /^\s*<!doctype html|<html/i.test(contents);
    const blob = new Blob([contents], {
      type: isHtml ? "text/html" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return w ? "ok" : "popup-blocked";
  } catch (e) {
    console.warn("[openArtifactInBrowser] failed:", e);
    return "error";
  }
}

/**
 * Tauri 환경에서만 호출. 브라우저에서는 isTauri() false 일 때 절대 부르지 마세요.
 */
export async function openArtifactInTauri(path: string): Promise<boolean> {
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(path);
    return true;
  } catch (e) {
    console.warn("[openArtifactInTauri] failed:", e);
    return false;
  }
}

/**
 * @deprecated 호환용. 새 코드는 isTauri() 분기 + openArtifactInBrowser/openArtifactInTauri 직접 사용.
 */
export async function openArtifact(path: string): Promise<boolean> {
  if (isTauri()) return openArtifactInTauri(path);
  return openArtifactInBrowser(path) === "ok";
}

/** ~ 확장 + 절대 경로화. Tauri 가 아니면 입력 그대로.
 *  새 Rust 명령(resolve_path) 미등록일 때를 대비해 JS 측 fallback 도 시도. */
export async function resolvePath(path: string): Promise<string> {
  if (!isTauri()) return path;
  // 1) 우리가 추가한 새 Rust 명령 시도.
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("resolve_path", { path });
  } catch {
    /* 다음 fallback */
  }
  // 2) JS 측에서 ~ 확장 — Tauri 2 path API 사용.
  try {
    if (!path.startsWith("~")) return path;
    const { homeDir } = await import("@tauri-apps/api/path");
    const home = await homeDir();
    // home 끝의 슬래시 정리.
    const trimmed = home.replace(/[/\\]+$/, "");
    if (path === "~") return trimmed;
    if (path.startsWith("~/") || path.startsWith("~\\")) {
      return `${trimmed}${path.slice(1)}`;
    }
    return path;
  } catch {
    return path;
  }
}

/** 폴더 경로를 직접 받아 시스템 핸들러로 열기. */
export async function openFolderDirect(folderPath: string): Promise<boolean> {
  if (!isTauri()) return false;
  // 1) 새 Rust 명령 시도.
  let firstErr: unknown = null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_in_system", { path: folderPath });
    return true;
  } catch (e) {
    firstErr = e;
    console.warn("[openFolderDirect] open_in_system 실패, shell.open 폴백:", e);
  }
  // 2) 폴백: shell.open. ~ 는 미리 확장.
  try {
    const abs = await resolvePath(folderPath);
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(abs);
    return true;
  } catch (e2) {
    // 두 시도 모두 실패 — 사용자/디버그용 터미널 로그에 기록.
    try {
      const { logTerminal } = await import("./terminalLog");
      logTerminal({
        kind: "error",
        text: `폴더 열기 실패: ${folderPath}`,
        detail: `1차 invoke open_in_system: ${firstErr instanceof Error ? firstErr.message : String(firstErr)} | 2차 shell.open: ${e2 instanceof Error ? e2.message : String(e2)}`,
      });
    } catch {
      /* terminalLog 자체 실패 — silent */
    }
    return false;
  }
}

/** 파일 경로를 받아 그 부모 폴더를 시스템 핸들러로 열기. */
export async function openFolderForFile(filePath: string): Promise<boolean> {
  return openFolderDirect(parentFolder(filePath));
}

/**
 * @deprecated `openFolderForFile` 또는 `openFolderDirect` 를 직접 사용하세요.
 * 호환을 위해 기본은 파일 경로 가정 + 부모 추출.
 */
export async function openFolder(filePath: string): Promise<boolean> {
  return openFolderForFile(filePath);
}

/** 폴더 보장 — 없으면 생성. 브라우저 데모: 즉시 가짜 성공. */
export type EnsureFolderResult = {
  path: string;
  created: boolean;
  alreadyExisted: boolean;
};

export async function ensureFolder(
  folderPath: string,
): Promise<EnsureFolderResult> {
  return safeInvoke<EnsureFolderResult>(
    "ensure_folder",
    { path: folderPath },
    () => ({ path: folderPath, created: true, alreadyExisted: false }),
  );
}

export type ArtifactFile = {
  name: string;
  sizeBytes: number;
  kind: "image" | "data" | "doc" | "code" | "other";
};

/** 폴더 결과 파일 나열 — VerifyHint(data) 가 호출. 데모 모드: 빈 배열. */
export async function listArtifactFiles(
  folderPath: string,
): Promise<ArtifactFile[]> {
  return safeInvoke<ArtifactFile[]>(
    "list_artifact_files",
    { folderPath },
    () => [],
  );
}

export type ServeArtifactResult = {
  url: string;
  port: number;
  localIp: string;
};

/** 친구한테 보여주기 — 임시 정적 서버 시작. 같은 Wi-Fi 폰에서 접속 가능. */
export async function serveArtifact(
  path: string,
): Promise<ServeArtifactResult> {
  return safeInvoke<ServeArtifactResult>("serve_artifact", { path }, () => ({
    url: "http://demo.local/",
    port: 0,
    localIp: "demo",
  }));
}

export async function stopServeArtifact(): Promise<void> {
  await safeInvoke<null>("stop_serve_artifact", undefined, () => null);
}

export type InstallClaudeResult = {
  success: boolean;
  method: string;
  stdout: string;
  stderr: string;
};

/** Claude Code 자동 설치 시도. 실패 시 success=false — 호출자가 설치 페이지로. */
export async function installClaudeCode(): Promise<InstallClaudeResult> {
  return safeInvoke<InstallClaudeResult>(
    "install_claude_code",
    undefined,
    async () => {
      // 데모 모드: 가짜 성공.
      await new Promise((r) => setTimeout(r, 1500));
      return {
        success: true,
        method: "(데모)",
        stdout: "(데모) Claude Code 설치 시뮬레이션",
        stderr: "",
      };
    },
  );
}

/** 지정 폴더에서 새 터미널 열기. with_command 있으면 자동 실행. */
export async function openTerminalIn(
  folderPath: string,
  withCommand?: string,
): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_terminal_in", {
      path: folderPath,
      withCommand: withCommand ?? null,
    });
    return true;
  } catch {
    return false;
  }
}

// parentFolder 는 ./paths 에서 re-export (위 line 3-4).

/**
 * Markdown 응답에서 첫 번째 코드 블록 본문만 추출.
 * ```html ... ``` 또는 ``` ... ``` 둘 다 지원.
 * 여러 코드 블록이 있으면 첫 번째만 — 호출자가 알 수 있게 콘솔에 로그.
 */
export function extractCodeBlock(markdown: string): string | null {
  const re = /```(?:[a-zA-Z0-9_-]*)?\r?\n([\s\S]*?)```/g;
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    if (m[1]) matches.push(m[1].trim());
  }
  if (matches.length > 1) {
    console.warn(
      `[extractCodeBlock] AI 답변에 코드 블록 ${matches.length}개 — 첫 번째만 사용.`,
    );
  }
  if (matches.length > 0) return matches[0]!;
  // 백틱 없는 응답이면 전체 반환 (HTML 같은 게 그대로 옴).
  if (/^\s*<!doctype html|<html/i.test(markdown)) return markdown.trim();
  return null;
}

import { invoke } from "@tauri-apps/api/core";

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
  return invoke<Environment>("inspect_environment", { force });
}

// 앱은 명령을 대신 실행하지 않는다(ADR-0004) — 옛 dryRun/installTool 래퍼는 제거됨.

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
};

export async function listRecipes(): Promise<Recipe[]> {
  return invoke<Recipe[]>("list_recipes");
}

export type LearningProgress = {
  total: number;
  mastered: number;
};

export async function trackTerm(term: string, context?: string): Promise<void> {
  await invoke("track_term", { term, context: context ?? null });
}

export async function learningProgress(): Promise<LearningProgress> {
  return invoke<LearningProgress>("learning_progress");
}

export type FileWriteResult = {
  path: string;
  bytes: number;
};

export async function writeFile(
  path: string,
  contents: string,
): Promise<FileWriteResult> {
  return invoke<FileWriteResult>("write_file", { path, contents });
}

export async function readFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}

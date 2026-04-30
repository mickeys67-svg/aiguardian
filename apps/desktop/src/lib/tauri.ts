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

export type DryRun = {
  command: string;
  explanation: string;
  blocked: boolean;
  blockReason: string | null;
};

export async function dryRun(command: string): Promise<DryRun> {
  return invoke<DryRun>("dry_run", { command });
}

export type InstallResult = {
  tool: string;
  success: boolean;
  stdout: string;
  stderr: string;
  commandUsed: string;
};

export async function installTool(tool: string): Promise<InstallResult> {
  return invoke<InstallResult>("install_tool", { tool });
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
  serverCommand: string,
  serverArgs: string[],
): Promise<McpStatus> {
  return invoke<McpStatus>("register_mcp", {
    client,
    serverCommand,
    serverArgs,
  });
}

export type RecipeStep = {
  id: string;
  title: string;
  description: string;
  command: string | null;
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

export type StepRunResult = {
  stepId: string;
  success: boolean;
  stdout: string;
  stderr: string;
  blocked: boolean;
};

export async function listRecipes(): Promise<Recipe[]> {
  return invoke<Recipe[]>("list_recipes");
}

export async function runRecipeStep(
  stepId: string,
  command: string,
  dry = false,
): Promise<StepRunResult> {
  return invoke<StepRunResult>("run_recipe_step", { stepId, command, dry });
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

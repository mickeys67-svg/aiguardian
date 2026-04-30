import { invoke } from "@tauri-apps/api/core";

export type Environment = {
  os: "macos" | "windows" | "linux";
  shell: string | null;
  runtimes: Record<string, string | null>;
  aiClients: Record<"claude_desktop" | "claude_code" | "cursor", boolean>;
  lastScanned: string;
};

export async function inspectEnvironment(): Promise<Environment> {
  return invoke<Environment>("inspect_environment");
}

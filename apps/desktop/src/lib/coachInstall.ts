// "코치 켜기" 오케스트레이션 — 사용자 대신 ~/.claude/settings.json 을 읽어
// 코치 Stop 훅을 넣고/빼고 다시 쓴다. JSON 손편집을 앱이 흡수한다. (ADR-0004)
//
// 병합 로직 자체는 @tg/coach/install(순수·테스트됨). 여기선 파일 IO만 담당.

import { homeDir } from "@tauri-apps/api/path";
import {
  addCoachStopHook,
  removeCoachStopHook,
  hasCoachStopHook,
  coachStopCommand,
} from "@tg/coach/install";
import { readFile, writeFile } from "./tauri";

const SETTINGS_REL = ".claude/settings.json";

async function settingsPath(): Promise<string> {
  const home = (await homeDir()).replace(/[\\/]+$/, "");
  return `${home}/${SETTINGS_REL}`;
}

async function readRaw(path: string): Promise<string> {
  try {
    return await readFile(path);
  } catch {
    return "";
  }
}

function parse(raw: string): Record<string, unknown> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** 현재 코치가 켜져 있나(Claude Code Stop 훅 기준). */
export async function coachInstalled(): Promise<boolean> {
  return hasCoachStopHook(parse(await readRaw(await settingsPath())));
}

/** 코치 켜기 — 훅 추가. 기존 settings 는 .bak 으로 백업. 설정 파일 경로 반환. */
export async function installCoach(scriptPath: string): Promise<string> {
  const path = await settingsPath();
  const raw = await readRaw(path);
  if (raw) {
    try {
      await writeFile(`${path}.bak`, raw);
    } catch {
      /* 백업 실패해도 설치는 진행(원본 손상 아님) */
    }
  }
  const next = addCoachStopHook(parse(raw), coachStopCommand(scriptPath));
  await writeFile(path, JSON.stringify(next, null, 2) + "\n");
  return path;
}

/** 코치 끄기 — 코치 훅만 제거(다른 훅·설정 보존). */
export async function uninstallCoach(): Promise<string> {
  const path = await settingsPath();
  const next = removeCoachStopHook(parse(await readRaw(path)));
  await writeFile(path, JSON.stringify(next, null, 2) + "\n");
  return path;
}

// localStorage 가비지 컬렉터 — 고아 키 정리.
// projects.v1 에 없는 path 의 tg.iter.snap.* / tg.iter.meta.* / tg.demo.file.* 키 일괄 삭제.

import { listProjects } from "./projects";

const KNOWN_PREFIXES = [
  "tg.iter.snap.",
  "tg.iter.meta.",
  "tg.demo.file.",
] as const;

export type GcResult = {
  scanned: number;
  removed: number;
  removedKeys: string[];
  totalKbBefore: number;
  totalKbAfter: number;
};

function approxKb(): number {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k);
      bytes += k.length + (v?.length ?? 0);
    }
  } catch {
    /* ignore */
  }
  return Math.round(bytes / 1024);
}

/** 고아 키 정리. dryRun=true 면 삭제 안 하고 목록만 반환. */
export function runStorageGc(dryRun = false): GcResult {
  const before = approxKb();
  const livePaths = new Set(
    listProjects()
      .map((p) => p.artifactPath)
      .filter((x): x is string => !!x),
  );

  const toRemove: string[] = [];
  let scanned = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      for (const prefix of KNOWN_PREFIXES) {
        if (k.startsWith(prefix)) {
          scanned++;
          const path = k.slice(prefix.length);
          if (!livePaths.has(path)) {
            toRemove.push(k);
          }
          break;
        }
      }
    }

    if (!dryRun) {
      for (const k of toRemove) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }

  return {
    scanned,
    removed: dryRun ? 0 : toRemove.length,
    removedKeys: toRemove,
    totalKbBefore: before,
    totalKbAfter: dryRun ? before : approxKb(),
  };
}

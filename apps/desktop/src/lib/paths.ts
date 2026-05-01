// 경로 헬퍼 — Tauri / 브라우저 양쪽에서 안전하게.
// 정규식이 여러 파일에 흩어져있던 걸 한 곳으로.

/** 파일 경로에서 부모 폴더 추출. ~/projects/x/index.html → ~/projects/x */
export function parentFolder(filePath: string): string {
  return filePath.replace(/[/\\][^/\\]+$/, "");
}

/** 파일 이름만 추출. ~/projects/x/index.html → index.html */
export function fileName(filePath: string): string {
  const m = /[/\\]([^/\\]+)$/.exec(filePath);
  return m?.[1] ?? filePath;
}

/** 같은 폴더의 다른 파일 경로. (~/x/a.html, "b.txt") → ~/x/b.txt */
export function siblingPath(filePath: string, newName: string): string {
  const folder = parentFolder(filePath);
  return folder ? `${folder}/${newName}` : newName;
}

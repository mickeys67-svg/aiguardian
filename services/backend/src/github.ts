// GitHub Releases 프록시 — 최신 release 메타를 가져와 KV에 30분 캐시.
// rate limit (60req/h unauthenticated) 회피용.

export interface GhAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

export interface GhRelease {
  tag_name: string;
  name: string;
  published_at: string;
  body: string;
  assets: GhAsset[];
}

const CACHE_KEY = "gh:latest-release";
const CACHE_TTL_SECONDS = 30 * 60;

export async function getLatestRelease(env: {
  CACHE?: KVNamespace;
  GH_OWNER?: string;
  GH_REPO?: string;
  GH_TOKEN?: string;
}): Promise<GhRelease | null> {
  const owner = env.GH_OWNER;
  const repo = env.GH_REPO;
  if (!owner || !repo) return null;

  if (env.CACHE) {
    const cached = await env.CACHE.get(CACHE_KEY, "json");
    if (cached) return cached as GhRelease;
  }

  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "tg-backend/0.1",
  };
  if (env.GH_TOKEN) {
    headers.authorization = `Bearer ${env.GH_TOKEN}`;
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
    { headers },
  );
  if (!res.ok) {
    return null;
  }
  const release = (await res.json()) as GhRelease;

  if (env.CACHE) {
    await env.CACHE.put(CACHE_KEY, JSON.stringify(release), {
      expirationTtl: CACHE_TTL_SECONDS,
    });
  }

  return release;
}

/** 플랫폼/아키별 자산 매칭 — Tauri 기본 산출물 명명 규칙. */
export function pickAsset(
  release: GhRelease,
  target: "windows" | "macos" | "linux",
  arch?: "x64" | "aarch64" | "universal",
): GhAsset | null {
  const lower = release.assets.map((a) => ({
    asset: a,
    name: a.name.toLowerCase(),
  }));

  if (target === "windows") {
    // MSI 우선: 일반 사용자에게 더 직관적이고 SmartScreen/UAC 흐름이 표준화돼있음.
    // NSIS(-setup.exe)는 fallback이자 Tauri Updater 채널용으로 계속 빌드됨.
    return (
      lower.find(({ name }) => name.endsWith(".msi"))?.asset ??
      lower.find(({ name }) => name.endsWith("-setup.exe"))?.asset ??
      null
    );
  }
  if (target === "macos") {
    if (arch === "aarch64") {
      return (
        lower.find(({ name }) => name.includes("aarch64") && name.endsWith(".dmg"))
          ?.asset ?? null
      );
    }
    if (arch === "x64") {
      return (
        lower.find(({ name }) => name.includes("x64") && name.endsWith(".dmg"))
          ?.asset ?? null
      );
    }
    return (
      lower.find(({ name }) => name.includes("universal") && name.endsWith(".dmg"))
        ?.asset ??
      lower.find(({ name }) => name.endsWith(".dmg"))?.asset ??
      null
    );
  }
  if (target === "linux") {
    return (
      lower.find(({ name }) => name.endsWith(".appimage"))?.asset ??
      lower.find(({ name }) => name.endsWith(".deb"))?.asset ??
      null
    );
  }
  return null;
}

/** Tauri Updater 가 기대하는 응답 형식. */
export interface UpdaterResponse {
  version: string;
  pub_date: string;
  url: string;
  signature: string;
  notes: string;
}

export function buildUpdaterResponse(
  release: GhRelease,
  target: "darwin-aarch64" | "darwin-x86_64" | "windows-x86_64" | "linux-x86_64",
): UpdaterResponse | null {
  const lookup: Record<typeof target, { ext: string; matcher: (n: string) => boolean }> = {
    "darwin-aarch64": {
      ext: ".app.tar.gz",
      matcher: (n) =>
        n.toLowerCase().includes("aarch64") && n.toLowerCase().endsWith(".app.tar.gz"),
    },
    "darwin-x86_64": {
      ext: ".app.tar.gz",
      matcher: (n) =>
        n.toLowerCase().includes("x64") && n.toLowerCase().endsWith(".app.tar.gz"),
    },
    "windows-x86_64": {
      ext: ".nsis.zip",
      matcher: (n) => n.toLowerCase().endsWith(".nsis.zip"),
    },
    "linux-x86_64": {
      ext: ".appimage.tar.gz",
      matcher: (n) => n.toLowerCase().endsWith(".appimage.tar.gz"),
    },
  };

  const cfg = lookup[target];
  const bundle = release.assets.find((a) => cfg.matcher(a.name));
  const sigAsset = release.assets.find((a) =>
    a.name.toLowerCase() === `${bundle?.name.toLowerCase()}.sig`,
  );
  if (!bundle) return null;

  return {
    version: release.tag_name.replace(/^v/, ""),
    pub_date: release.published_at,
    url: bundle.browser_download_url,
    signature: sigAsset ? "" : "", // 실제 sig 파일 내용은 fetch 후 채움 (아래 fetchSignature)
    notes: release.body?.slice(0, 500) ?? "",
  };
}

export async function fetchSignature(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) return "";
  return (await res.text()).trim();
}

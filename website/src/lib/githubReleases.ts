type GitHubAsset = {
  name: string;
  browser_download_url: string;
};

type GitHubRelease = {
  tag_name: string;
  published_at: string | null;
  assets: GitHubAsset[];
};

function normalizeVersion(tag: string): string {
  const t = String(tag || '').trim();
  return t.startsWith('v') ? t.slice(1) : t;
}

function env(name: string): string | null {
  const v = process.env[name];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

export type GitHubReleaseInfo = {
  version: string;
  date: string | null;
  apkUrl: string | null;
  sha256Url: string | null;
};

export async function getGitHubLatestRelease(): Promise<GitHubReleaseInfo | null> {
  const owner = env('GITHUB_RELEASES_OWNER');
  const repo = env('GITHUB_RELEASES_REPO');
  if (!owner || !repo) return null;

  const token = env('GITHUB_RELEASES_TOKEN');
  const api = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(api, {
    method: 'GET',
    headers,
    next: { revalidate: 300 },
  });

  if (!res.ok) return null;
  const release = (await res.json()) as GitHubRelease;

  const version = normalizeVersion(release.tag_name);
  const date = release.published_at ? String(release.published_at).slice(0, 10) : null;

  const apk = release.assets?.find((a) => /\.apk$/i.test(a.name)) ?? null;
  const sha = release.assets?.find((a) => /sha256/i.test(a.name)) ?? null;

  return {
    version,
    date,
    apkUrl: apk?.browser_download_url ?? null,
    sha256Url: sha?.browser_download_url ?? null,
  };
}

export async function getGitHubReleases(limit: number = 20): Promise<GitHubReleaseInfo[]> {
  const owner = env('GITHUB_RELEASES_OWNER');
  const repo = env('GITHUB_RELEASES_REPO');
  if (!owner || !repo) return [];

  const token = env('GITHUB_RELEASES_TOKEN');
  const api = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=${Math.max(1, Math.min(100, limit))}`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(api, {
    method: 'GET',
    headers,
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];

  const releases = (await res.json()) as GitHubRelease[];
  const infos: GitHubReleaseInfo[] = [];
  for (const r of releases) {
    const version = normalizeVersion(r.tag_name);
    const date = r.published_at ? String(r.published_at).slice(0, 10) : null;
    const apk = r.assets?.find((a) => /\.apk$/i.test(a.name)) ?? null;
    const sha = r.assets?.find((a) => /sha256/i.test(a.name)) ?? null;
    infos.push({
      version,
      date,
      apkUrl: apk?.browser_download_url ?? null,
      sha256Url: sha?.browser_download_url ?? null,
    });
  }
  return infos;
}

import fs from 'node:fs/promises';
import { getGitHubLatestRelease, getGitHubReleases } from './githubReleases';
import { resolveRepoFile } from './repoFs';

type DownloadItem = {
  version: string;
  date?: string | null;
  apk?: { url?: string; sha256?: string };
};

export type DownloadsConfig = {
  downloadsPageUrl?: string;
  latest?: DownloadItem;
  previous?: DownloadItem[];
};

export async function getDownloads(): Promise<DownloadsConfig> {
  let local: DownloadsConfig = { downloadsPageUrl: 'https://irontrain.motiona.xyz/downloads', latest: undefined, previous: [] };
  try {
    const filePath =
      (await resolveRepoFile('website/content/DOWNLOADS.json')) ??
      (await resolveRepoFile('content/DOWNLOADS.json')) ??
      (await resolveRepoFile('docs/DOWNLOADS.json'));
    if (!filePath) throw new Error('DOWNLOADS.json not found');
    const raw = await fs.readFile(filePath, 'utf8');
    local = JSON.parse(raw) as DownloadsConfig;
  } catch {
  }

  const gh = await getGitHubLatestRelease();
  const ghAll = await getGitHubReleases(50);
  const ghMap = new Map<string, { url?: string; date?: string | null; sha256Url?: string | null }>();
  for (const r of ghAll) {
    if (!r.version) continue;
    ghMap.set(r.version, { url: r.apkUrl ?? undefined, date: r.date ?? null, sha256Url: r.sha256Url ?? null });
  }

  const enrich = (item: DownloadItem | undefined): DownloadItem | undefined => {
    if (!item?.version) return item;
    const m = ghMap.get(item.version);
    if (!m) return item;
    return {
      ...item,
      date: item.date ?? m.date ?? null,
      apk: {
        url: item.apk?.url ?? m.url,
        sha256: item.apk?.sha256,
      },
    };
  };

  const localEnriched: DownloadsConfig = {
    downloadsPageUrl: local.downloadsPageUrl ?? 'https://irontrain.motiona.xyz/downloads',
    latest: enrich(local.latest),
    previous: (local.previous ?? []).map((p) => enrich(p) as DownloadItem),
  };

  const previousFromGh: DownloadItem[] = ghAll
    .filter((r) => !!r.version && r.version !== (gh?.version ?? localEnriched.latest?.version))
    .map((r) => ({
      version: r.version!,
      date: r.date ?? null,
      apk: { url: r.apkUrl ?? undefined, sha256: undefined },
    }));

  const previousMergedMap = new Map<string, DownloadItem>();
  for (const p of localEnriched.previous ?? []) {
    if (!p?.version) continue;
    previousMergedMap.set(p.version, p);
  }
  for (const p of previousFromGh) {
    if (!p?.version) continue;
    const existing = previousMergedMap.get(p.version);
    if (existing) {
      previousMergedMap.set(p.version, {
        version: existing.version,
        date: existing.date ?? p.date ?? null,
        apk: { url: existing.apk?.url ?? p.apk?.url, sha256: existing.apk?.sha256 },
      });
    } else {
      previousMergedMap.set(p.version, p);
    }
  }

  if (!gh) return localEnriched;

  const mergedLatest: DownloadItem = {
    version: gh.version || localEnriched.latest?.version || '0.0.0',
    date: gh.date ?? localEnriched.latest?.date ?? null,
    apk: {
      url: gh.apkUrl ?? localEnriched.latest?.apk?.url,
      sha256: localEnriched.latest?.apk?.sha256,
    },
  };

  return {
    downloadsPageUrl: localEnriched.downloadsPageUrl ?? 'https://irontrain.motiona.xyz/downloads',
    latest: mergedLatest,
    previous: Array.from(previousMergedMap.values()),
  };
}

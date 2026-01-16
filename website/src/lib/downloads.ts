import fs from 'node:fs/promises';
import { getGitHubLatestRelease } from './githubReleases';
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
  if (!gh) return local;

  const mergedLatest: DownloadItem = {
    version: gh.version || local.latest?.version || '0.0.0',
    date: gh.date ?? local.latest?.date ?? null,
    apk: {
      url: gh.apkUrl ?? local.latest?.apk?.url,
      sha256: local.latest?.apk?.sha256,
    },
  };

  return {
    downloadsPageUrl: local.downloadsPageUrl ?? 'https://irontrain.motiona.xyz/downloads',
    latest: mergedLatest,
    previous: local.previous ?? [],
  };
}

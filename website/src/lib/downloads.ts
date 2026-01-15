import fs from 'node:fs/promises';
import path from 'node:path';
import { getGitHubLatestRelease } from './githubReleases';

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
  const filePath = path.resolve(process.cwd(), '..', 'docs', 'DOWNLOADS.json');
  let local: DownloadsConfig = { downloadsPageUrl: 'https://irontrain.motiona.xyz/downloads', latest: undefined, previous: [] };
  try {
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

import { NextResponse } from 'next/server';
import { getChangelog } from '../../src/lib/changelog';
import { getDownloads } from '../../src/lib/downloads';
import { compareSemver, isSemver } from '../../src/lib/version';

export async function GET() {
  const changelog = await getChangelog();
  const downloads = await getDownloads();

  const released = changelog.releases.filter((r) => r.unreleased !== true);
  const latestChangelog = released[0] ?? null;
  const latestDownload = downloads.latest ?? null;

  const downloadHasApk = !!latestDownload?.apk?.url;
  const canCompare = !!latestChangelog && !!latestDownload && isSemver(latestChangelog.version) && isSemver(latestDownload.version);

  const preferredVersion =
    canCompare
      ? (compareSemver(latestDownload!.version, latestChangelog!.version) > 0 ? latestDownload!.version : latestChangelog!.version)
      : (latestChangelog?.version ?? latestDownload?.version ?? null);

  const latest =
    preferredVersion
      ? {
          version: preferredVersion,
          date:
            (preferredVersion === latestDownload?.version ? (latestDownload?.date ?? null) : null) ??
            (preferredVersion === latestChangelog?.version ? (latestChangelog?.date ?? null) : null) ??
            null,
        }
      : null;

  const downloadUrl =
    downloadHasApk && latestDownload?.version && preferredVersion === latestDownload.version
      ? latestDownload.apk?.url ?? null
      : null;

  const payload = {
    latest: latest
      ? {
          version: latest.version,
          date: latest.date ?? null,
          downloadUrl,
          notesUrl: 'https://irontrain.motiona.xyz/changelog',
        }
      : null,
    downloadsPageUrl: downloads.downloadsPageUrl || 'https://irontrain.motiona.xyz/downloads',
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  });
}

import { NextResponse } from 'next/server';
import { getChangelog } from '../../src/lib/changelog';
import { getDownloads } from '../../src/lib/downloads';
import { compareSemver, isSemver } from '../../src/lib/version';

export async function GET() {
  const changelog = await getChangelog();
  const downloads = await getDownloads();

  const released = changelog.releases.filter((r) => r.unreleased !== true);
  const latestChangelog = released[0] ?? null;
  const candidates = [downloads.latest, ...(downloads.previous ?? [])].filter(Boolean) as Array<{
    version?: string;
    date?: string | null;
    apk?: { url?: string };
  }>;

  let best: { version: string; date: string | null; url: string } | null = null;
  for (const c of candidates) {
    const v = c.version;
    const url = c.apk?.url;
    if (!v || !url) continue;
    if (!isSemver(v)) continue;
    if (!best || compareSemver(v, best.version) > 0) {
      best = { version: v, date: (c.date ?? null) as any, url };
    }
  }

  const latest = best
    ? { version: best.version, date: best.date ?? null, downloadUrl: best.url }
    : (latestChangelog ? { version: latestChangelog.version, date: latestChangelog.date ?? null, downloadUrl: null } : null);

  const payload = {
    latest: latest
      ? {
          version: latest.version,
          date: latest.date ?? null,
          downloadUrl: latest.downloadUrl ?? null,
          notesUrl: `https://irontrain.motiona.xyz/changelog#v${latest.version}`,
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

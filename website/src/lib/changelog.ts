import fs from 'node:fs/promises';
import path from 'node:path';

export type ChangelogRelease = {
  version: string;
  date: string | null;
  unreleased: boolean;
  items: string[];
};

export type ChangelogPayload = {
  releases: ChangelogRelease[];
};

function parseReleaseHeading(line: string): { version: string; date: string | null; unreleased: boolean } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('## ')) return null;
  const title = trimmed.replace(/^##\s+/, '').trim();
  const m = title.match(/^(\d+\.\d+\.\d+)\s*\(([^)]+)\)\s*$/);
  if (!m) return { version: title, date: null, unreleased: true };
  const version = m[1];
  const rawDate = m[2];
  const isUnreleased = String(rawDate).trim().toLowerCase() === 'unreleased';
  return { version, date: isUnreleased ? null : rawDate, unreleased: isUnreleased };
}

function semverKey(version: string): { major: number; minor: number; patch: number } | null {
  const m = String(version).trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function compareSemverDesc(a: ChangelogRelease, b: ChangelogRelease): number {
  const ka = semverKey(a.version);
  const kb = semverKey(b.version);
  if (!ka && !kb) return 0;
  if (!ka) return 1;
  if (!kb) return -1;
  if (ka.major !== kb.major) return kb.major - ka.major;
  if (ka.minor !== kb.minor) return kb.minor - ka.minor;
  return kb.patch - ka.patch;
}

export async function getChangelog(): Promise<ChangelogPayload> {
  const filePath = path.resolve(process.cwd(), '..', 'docs', 'CHANGELOG.md');
  const md = await fs.readFile(filePath, 'utf8');
  const lines = md.split(/\r?\n/);

  const releases: ChangelogRelease[] = [];
  let current: ChangelogRelease | null = null;

  for (const line of lines) {
    const rel = parseReleaseHeading(line);
    if (rel) {
      if (current) releases.push(current);
      current = { version: rel.version, date: rel.date, unreleased: rel.unreleased, items: [] };
      continue;
    }

    if (!current) continue;
    const bullet = line.match(/^\s*-\s+(.*)\s*$/);
    if (bullet) {
      const text = bullet[1].trim();
      if (text.length > 0) current.items.push(text);
    }
  }
  if (current) releases.push(current);

  const normalized = releases.filter((r) => r.items.length > 0).sort(compareSemverDesc);
  return { releases: normalized };
}


const fs = require('fs');
const path = require('path');

function parseReleaseHeading(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('## ')) return null;
  const title = trimmed.replace(/^##\s+/, '').trim();

  const m = title.match(/^(\d+\.\d+\.\d+)\s*\(([^)]+)\)\s*$/);
  if (!m) return { version: title, date: null, rawTitle: title };
  const version = m[1];
  const rawDate = m[2];
  const isUnreleased = String(rawDate).trim().toLowerCase() === 'unreleased';
  const date = isUnreleased ? null : rawDate;
  return { version, date, rawTitle: title, unreleased: isUnreleased };
}

function semverKey(version) {
  const m = String(version).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function compareSemverDesc(a, b) {
  const ka = semverKey(a.version);
  const kb = semverKey(b.version);
  if (!ka && !kb) return 0;
  if (!ka) return 1;
  if (!kb) return -1;
  if (ka.major !== kb.major) return kb.major - ka.major;
  if (ka.minor !== kb.minor) return kb.minor - ka.minor;
  return kb.patch - ka.patch;
}

function generate() {
  const repoRoot = path.resolve(__dirname, '..');
  const inputPath = path.join(repoRoot, 'docs', 'CHANGELOG.md');
  const outputPath = path.join(repoRoot, 'src', 'changelog.generated.json');

  const md = fs.readFileSync(inputPath, 'utf8');
  const lines = md.split(/\r?\n/);

  const releases = [];
  let current = null;

  for (const line of lines) {
    const rel = parseReleaseHeading(line);
    if (rel) {
      if (current) releases.push(current);
      current = { version: rel.version, date: rel.date, unreleased: !!rel.unreleased, items: [] };
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

  const normalized = releases
    .filter((r) => r.items.length > 0)
    .sort(compareSemverDesc);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'docs/CHANGELOG.md',
    releases: normalized,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return payload;
}

module.exports = { generate };

if (require.main === module) {
  try {
    generate();
  } catch (e) {
    console.error('Failed to generate changelog:', e);
    process.exitCode = 1;
  }
}

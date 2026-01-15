const fs = require('fs');
const path = require('path');

const { generate } = require('./generate-changelog');

function isSemver(v) {
  return /^\d+\.\d+\.\d+$/.test(String(v).trim());
}

function bumpPatch(version) {
  const [a, b, c] = String(version).trim().split('.').map(Number);
  return `${a}.${b}.${c + 1}`;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const changelogPath = path.join(repoRoot, 'docs', 'CHANGELOG.md');
  const appJsonPath = path.join(repoRoot, 'app.json');

  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const currentVersion = String(appJson?.expo?.version ?? '');
  if (!isSemver(currentVersion)) throw new Error('app.json no tiene una versión semver válida');

  const md = fs.readFileSync(changelogPath, 'utf8');
  const lines = md.split(/\r?\n/);

  const unreleasedHeading = `## ${currentVersion} (Unreleased)`;
  const idx = lines.findIndex((l) => l.trim() === unreleasedHeading);
  if (idx === -1) {
    throw new Error(`No se encontró la sección "${unreleasedHeading}" en docs/CHANGELOG.md`);
  }

  lines[idx] = `## ${currentVersion} (${todayIsoDate()})`;

  const nextVersion = bumpPatch(currentVersion);
  const nextHeading = `## ${nextVersion} (Unreleased)`;
  const hasNext = lines.some((l) => l.trim() === nextHeading);

  if (!hasNext) {
    const headerIdx = lines.findIndex((l) => l.trim() === '# Changelog');
    if (headerIdx === -1) throw new Error('CHANGELOG.md inválido: falta "# Changelog"');

    let insertAt = headerIdx + 1;
    while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt++;

    const block = [
      '',
      nextHeading,
      '- Placeholder: describir cambios nuevos antes del próximo release.',
      '',
    ];
    lines.splice(insertAt, 0, ...block);
  }

  const updated = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(changelogPath, updated.endsWith('\n') ? updated : updated + '\n', 'utf8');

  generate();
}

try {
  main();
} catch (e) {
  console.error(String(e && e.message ? e.message : e));
  process.exitCode = 1;
}


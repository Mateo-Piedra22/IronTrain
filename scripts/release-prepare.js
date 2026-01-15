const fs = require('fs');
const path = require('path');

const { generate } = require('./generate-changelog');

function isSemver(v) {
  return /^\d+\.\d+\.\d+$/.test(String(v).trim());
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function upsertUnreleasedSection(md, version) {
  const lines = md.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.trim() === '# Changelog');
  if (headerIdx === -1) throw new Error('CHANGELOG.md inválido: falta "# Changelog"');

  const heading = `## ${version} (Unreleased)`;

  const existingIdx = lines.findIndex((l) => l.trim() === heading);
  if (existingIdx !== -1) {
    const nextLine = lines[existingIdx + 1] ?? '';
    if (!/^\s*-\s+/.test(nextLine)) {
      lines.splice(existingIdx + 1, 0, '- Placeholder: describir cambios nuevos antes del próximo release.');
    }
    return lines.join('\n');
  }

  let insertAt = headerIdx + 1;
  while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt++;

  const block = [
    '',
    heading,
    '- Placeholder: describir cambios nuevos antes del próximo release.',
    '',
  ];

  lines.splice(insertAt, 0, ...block);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const version = process.argv[2];
  if (!version || !isSemver(version)) {
    throw new Error('Uso: node scripts/release-prepare.js <x.y.z>');
  }

  const appJsonPath = path.join(repoRoot, 'app.json');
  const pkgPath = path.join(repoRoot, 'package.json');
  const changelogPath = path.join(repoRoot, 'docs', 'CHANGELOG.md');

  const appJson = readJson(appJsonPath);
  appJson.expo = appJson.expo || {};
  appJson.expo.version = version;
  writeJson(appJsonPath, appJson);

  const pkg = readJson(pkgPath);
  pkg.version = version;
  writeJson(pkgPath, pkg);

  const md = fs.readFileSync(changelogPath, 'utf8');
  const updated = upsertUnreleasedSection(md, version);
  fs.writeFileSync(changelogPath, updated.endsWith('\n') ? updated : updated + '\n', 'utf8');

  generate();
}

try {
  main();
} catch (e) {
  console.error(String(e && e.message ? e.message : e));
  process.exitCode = 1;
}


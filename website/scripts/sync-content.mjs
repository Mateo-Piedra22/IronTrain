import fs from 'node:fs/promises';
import path from 'node:path';

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function copyIfExists(src, dest) {
  try {
    const data = await fs.readFile(src);
    await fs.writeFile(dest, data);
    return true;
  } catch {
    return false;
  }
}

const websiteRoot = process.cwd();
const repoRoot = path.resolve(websiteRoot, '..');
const contentDir = path.join(websiteRoot, 'content');

await ensureDir(contentDir);

const changelogSrc = path.join(repoRoot, 'docs', 'CHANGELOG.md');
const downloadsSrc = path.join(repoRoot, 'docs', 'DOWNLOADS.json');

const changelogDest = path.join(contentDir, 'CHANGELOG.md');
const downloadsDest = path.join(contentDir, 'DOWNLOADS.json');

await copyIfExists(changelogSrc, changelogDest);
await copyIfExists(downloadsSrc, downloadsDest);


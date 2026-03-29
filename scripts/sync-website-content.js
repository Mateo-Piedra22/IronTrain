const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(src, dst) {
  const content = fs.readFileSync(src, 'utf8');
  ensureDir(path.dirname(dst));
  fs.writeFileSync(dst, content, 'utf8');
}

function syncWebsiteContent(repoRoot) {
  const pairs = [
    {
      src: path.join(repoRoot, 'docs', 'CHANGELOG.md'),
      dst: path.join(repoRoot, 'website', 'content', 'CHANGELOG.md'),
    },
    {
      src: path.join(repoRoot, 'docs', 'DOWNLOADS.json'),
      dst: path.join(repoRoot, 'website', 'content', 'DOWNLOADS.json'),
    },
    {
      src: path.join(repoRoot, 'src', 'services', 'SyncProtocol.ts'),
      dst: path.join(repoRoot, 'website', 'src', 'lib', 'sync', 'SyncProtocol.ts'),
    },
    {
      src: path.join(repoRoot, 'src', 'services', 'SyncMapper.ts'),
      dst: path.join(repoRoot, 'website', 'src', 'lib', 'sync', 'SyncMapper.ts'),
    },
  ];

  for (const p of pairs) copyFile(p.src, p.dst);
}

module.exports = { syncWebsiteContent };

if (require.main === module) {
  const repoRoot = path.resolve(__dirname, '..');
  syncWebsiteContent(repoRoot);
}

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
  ];

  /**
   * IMPORTANT: Sync engine files are intentionally NOT auto-copied.
   *
   * Why this is disabled:
   * - Website currently has server-specific sync behavior (e.g. TO_DRIZZLE path)
   *   used by sync push routes.
   * - Mobile/shared source files can differ by design from website runtime needs.
   * - Blind copy can silently break website sync contract.
   *
   * History:
   * - This auto-copy behavior was introduced later to keep parity, but in practice
   *   parity-by-copy is unsafe while contracts differ.
   *
   * If re-enabling in the future:
   * 1) Verify website sync routes do not depend on website-only mapper/protocol behavior.
   * 2) Align MapDirection + SyncMapper branches across both targets.
   * 3) Add/confirm regression tests for website sync push/pull before release.
   */
  const ENABLE_SYNC_ENGINE_FILE_COPY = false;
  const syncEnginePairs = [
    {
      src: path.join(repoRoot, 'src', 'services', 'SyncProtocol.ts'),
      dst: path.join(repoRoot, 'website', 'src', 'lib', 'sync', 'SyncProtocol.ts'),
    },
    {
      src: path.join(repoRoot, 'src', 'services', 'SyncMapper.ts'),
      dst: path.join(repoRoot, 'website', 'src', 'lib', 'sync', 'SyncMapper.ts'),
    },
  ];

  if (ENABLE_SYNC_ENGINE_FILE_COPY) {
    pairs.push(...syncEnginePairs);
  }

  for (const p of pairs) copyFile(p.src, p.dst);
}

module.exports = { syncWebsiteContent };

if (require.main === module) {
  const repoRoot = path.resolve(__dirname, '..');
  syncWebsiteContent(repoRoot);
}

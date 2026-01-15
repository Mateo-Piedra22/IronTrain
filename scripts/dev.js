const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const { generate } = require('./generate-changelog');

function safeGenerate() {
  try {
    generate();
  } catch (e) {
    console.error('Failed to generate changelog:', e);
  }
}

function startExpo(extraArgs) {
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const child = spawn(cmd, ['expo', 'start', ...extraArgs], { stdio: 'inherit' });

  const forward = (signal) => {
    try {
      child.kill(signal);
    } catch { }
  };

  process.on('SIGINT', () => forward('SIGINT'));
  process.on('SIGTERM', () => forward('SIGTERM'));

  child.on('exit', (code) => {
    process.exitCode = code ?? 0;
  });
}

function watchChangelog() {
  const repoRoot = path.resolve(__dirname, '..');
  const changelogPath = path.join(repoRoot, 'docs', 'CHANGELOG.md');

  let lastMtime = 0;
  let debounceTimer = null;

  const tick = () => {
    fs.stat(changelogPath, (err, stats) => {
      if (err) return;
      const mtime = Number(stats.mtimeMs || 0);
      if (mtime <= lastMtime) return;
      lastMtime = mtime;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => safeGenerate(), 250);
    });
  };

  safeGenerate();
  tick();

  fs.watchFile(changelogPath, { interval: 500 }, tick);
}

watchChangelog();
startExpo(process.argv.slice(2));


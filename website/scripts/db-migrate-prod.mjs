import 'dotenv/config';
import { spawn } from 'node:child_process';

function run() {
  return new Promise((resolve, reject) => {
    const command = process.platform === 'win32'
      ? 'npx drizzle-kit migrate --config=drizzle.config.ts'
      : 'npx drizzle-kit migrate --config=drizzle.config.ts';

    const child = spawn(command, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env,
      shell: true,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`drizzle-kit migrate failed with exit code ${code}`));
    });
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run migrations.');
  }

  console.log('[db:migrate:prod] Starting drizzle migrations...');
  await run();
  console.log('[db:migrate:prod] Migrations finished successfully.');
}

main().catch((error) => {
  console.error('[db:migrate:prod] Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});

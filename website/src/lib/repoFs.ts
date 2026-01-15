import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function parentChain(start: string, depth: number): string[] {
  const out: string[] = [];
  let cur = start;
  for (let i = 0; i < depth; i++) {
    out.push(cur);
    const next = path.dirname(cur);
    if (next === cur) break;
    cur = next;
  }
  return out;
}

export async function resolveRepoFile(relativePath: string): Promise<string | null> {
  const rel = relativePath.replace(/^[\\/]+/, '');

  const candidates = new Set<string>();

  for (const base of parentChain(process.cwd(), 7)) candidates.add(base);

  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    for (const base of parentChain(here, 10)) candidates.add(base);
  } catch {
  }

  candidates.add('/vercel/path0');
  candidates.add('/vercel/path0/website');
  candidates.add('/vercel/path1');
  candidates.add('/vercel/path1/website');

  for (const base of candidates) {
    const abs = path.join(base, rel);
    if (await exists(abs)) return abs;
  }

  return null;
}

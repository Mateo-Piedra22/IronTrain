export function isSemver(v: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(String(v).trim());
}

export function compareSemver(a: string, b: string): number {
  const pa = String(a).trim().split('.').map(Number);
  const pb = String(b).trim().split('.').map(Number);
  if (pa.length !== 3 || pb.length !== 3) return 0;
  if (pa[0] !== pb[0]) return pa[0] - pb[0];
  if (pa[1] !== pb[1]) return pa[1] - pb[1];
  return pa[2] - pb[2];
}


function hex(byte: number): string {
  return byte.toString(16).padStart(2, '0');
}

function randomBytes(count: number): Uint8Array {
  const g = globalThis as any;
  const c = g?.crypto;
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(count);
    c.getRandomValues(bytes);
    return bytes;
  }
  const bytes = new Uint8Array(count);
  for (let i = 0; i < count; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

export function uuidV4(): string {
  const g = globalThis as any;
  const c = g?.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();

  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return (
    hex(bytes[0]) +
    hex(bytes[1]) +
    hex(bytes[2]) +
    hex(bytes[3]) +
    '-' +
    hex(bytes[4]) +
    hex(bytes[5]) +
    '-' +
    hex(bytes[6]) +
    hex(bytes[7]) +
    '-' +
    hex(bytes[8]) +
    hex(bytes[9]) +
    '-' +
    hex(bytes[10]) +
    hex(bytes[11]) +
    hex(bytes[12]) +
    hex(bytes[13]) +
    hex(bytes[14]) +
    hex(bytes[15])
  );
}


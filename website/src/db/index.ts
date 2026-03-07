import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

function normalizeDbUrl(rawUrl: string): string {
    try {
        const parsed = new URL(rawUrl);
        const sslmode = parsed.searchParams.get('sslmode')?.toLowerCase();
        const isNeonHost = parsed.hostname.toLowerCase().includes('neon.tech');
        if (!sslmode && isNeonHost) {
            parsed.searchParams.set('sslmode', 'verify-full');
        }
        if (sslmode === 'require' || sslmode === 'prefer' || sslmode === 'verify-ca') {
            parsed.searchParams.set('sslmode', 'verify-full');
        }
        if (parsed.searchParams.has('uselibpqcompat')) {
            parsed.searchParams.delete('uselibpqcompat');
        }
        return parsed.toString();
    } catch {
        return rawUrl;
    }
}

const dbUrl = normalizeDbUrl(process.env.DATABASE_URL || 'postgres://user:pass@host/db');
const pool = new Pool({
    connectionString: dbUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

export const db = drizzle({ client: pool, schema });

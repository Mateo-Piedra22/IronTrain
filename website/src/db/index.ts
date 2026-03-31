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

function validateProductionDatabaseTarget(dbUrl: string): void {
    const requiredDbName = process.env.REQUIRED_NEON_DB_NAME || 'irontrain-maindb';

    if (process.env.NODE_ENV !== 'production') return;

    try {
        const parsed = new URL(dbUrl);
        const isNeonHost = parsed.hostname.toLowerCase().includes('neon.tech');
        if (!isNeonHost) return;

        const currentDbName = parsed.pathname.replace(/^\//, '').trim();
        if (!currentDbName || currentDbName === requiredDbName) return;

        throw new Error(
            `Invalid production database target: expected "${requiredDbName}", got "${currentDbName}". Please verify your DATABASE_URL environment variable points to the correct database.`,
        );
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Unable to validate production database target.');
    }
}

// NOTE: On serverless platforms (Vercel), each function invocation
// may spin up a new pool instance. Keep max low to prevent exhausting
// the Neon connection quota. Use Neon's serverless driver for edge routes.
const dbUrl = normalizeDbUrl(process.env.DATABASE_URL || 'postgres://user:pass@host/db');
validateProductionDatabaseTarget(dbUrl);
const pool = new Pool({
    connectionString: dbUrl,
    max: 5,                      // Reduced from 10 for serverless safety
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

export const db = drizzle({ client: pool, schema });

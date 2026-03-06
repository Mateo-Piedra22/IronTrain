import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL || 'postgres://user:pass@host/db';
const pool = new Pool({
    connectionString: dbUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: dbUrl.includes('sslmode=require') ? undefined : { rejectUnauthorized: false },
});

export const db = drizzle({ client: pool });

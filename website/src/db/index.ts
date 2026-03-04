import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// We fall back to a mock string for build purposes if env is missing
const dbUrl = process.env.DATABASE_URL || 'postgres://user:pass@host/db';
const sql = neon(dbUrl);

export const db = drizzle(sql);

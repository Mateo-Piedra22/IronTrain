import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

// We fall back to a mock string for build purposes if env is missing
const dbUrl = process.env.DATABASE_URL || 'postgres://user:pass@host/db';
if (typeof WebSocket !== 'undefined') {
    neonConfig.webSocketConstructor = WebSocket as any;
}
const pool = new Pool({ connectionString: dbUrl });

export const db = drizzle({ client: pool });

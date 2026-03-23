import { desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';
import { logger } from '../../../../../src/lib/logger';

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const history = await db
            .select()
            .from(schema.weatherLogs)
            .where(eq(schema.weatherLogs.userId, userId))
            .orderBy(desc(schema.weatherLogs.createdAt))
            .limit(20);

        return NextResponse.json({ success: true, history });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        logger.error('[Weather History API] Error', { error: message });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

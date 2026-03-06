import { and, eq, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const url = new URL(req.url);
        const query = url.searchParams.get('q')?.trim();

        if (!query || query.length === 0) {
            return NextResponse.json({ success: true, users: [] });
        }

        if (query.length > 128) {
            return NextResponse.json({ error: 'Query too long' }, { status: 400 });
        }

        const users = await db.select({
            id: schema.userProfiles.id,
            displayName: schema.userProfiles.displayName,
            username: schema.userProfiles.username,
        }).from(schema.userProfiles).where(
            and(
                eq(schema.userProfiles.isPublic, 1),
                or(
                    eq(schema.userProfiles.id, query),
                    eq(schema.userProfiles.username, query.toLowerCase())
                )
            )
        ).limit(10);

        // Filter out current user from results
        const filtered = users.filter(u => u.id !== userId);

        return NextResponse.json({ success: true, users: filtered });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

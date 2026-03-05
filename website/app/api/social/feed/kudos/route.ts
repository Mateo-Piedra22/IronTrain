import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { feedId } = body;

        if (!feedId) return NextResponse.json({ error: 'Invalid feed ID' }, { status: 400 });

        // Check if kudo already exists
        const existing = await db.select()
            .from(schema.kudos)
            .where(and(
                eq(schema.kudos.feedId, feedId),
                eq(schema.kudos.giverId, userId)
            ));

        if (existing.length > 0) {
            // Remove kudo
            await db.delete(schema.kudos).where(eq(schema.kudos.id, existing[0].id));
            return NextResponse.json({ success: true, action: 'removed' });
        } else {
            // Add kudo
            const kbaseId = crypto.randomUUID();
            await db.insert(schema.kudos).values({
                id: kbaseId,
                feedId,
                giverId: userId,
            });
            return NextResponse.json({ success: true, action: 'added' });
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

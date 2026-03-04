import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { inboxId, action } = body;

        if (!inboxId || typeof inboxId !== 'string') {
            return NextResponse.json({ error: 'Invalid inboxId' }, { status: 400 });
        }
        if (!action || !['accept', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const existing = await db.select().from(schema.sharesInbox).where(eq(schema.sharesInbox.id, inboxId));
        if (existing.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const item = existing[0];

        if (item.receiverId !== userId) {
            return NextResponse.json({ error: 'Unauthorized relation' }, { status: 403 });
        }
        if (item.status !== 'pending') {
            return NextResponse.json({ error: 'Item already responded to' }, { status: 400 });
        }

        const now = new Date();

        if (action === 'accept') {
            await db.update(schema.sharesInbox)
                .set({ status: 'accepted', updatedAt: now })
                .where(eq(schema.sharesInbox.id, inboxId));
        } else {
            // Reject: set status and soft-delete in single update
            await db.update(schema.sharesInbox)
                .set({ status: 'rejected', deletedAt: now, updatedAt: now })
                .where(eq(schema.sharesInbox.id, inboxId));
        }

        return NextResponse.json({ success: true, message: 'Action executed' });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

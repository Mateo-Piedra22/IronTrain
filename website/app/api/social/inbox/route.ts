import { and, eq, inArray, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const records = await db.select()
            .from(schema.sharesInbox)
            .where(
                and(
                    eq(schema.sharesInbox.receiverId, userId),
                    isNull(schema.sharesInbox.deletedAt)
                )
            );

        // Fetch sender display names
        const senderIds = [...new Set(records.map(r => r.senderId))];
        const profilesMap = new Map<string, string>();

        if (senderIds.length > 0) {
            const allProfiles = await db.select({
                id: schema.userProfiles.id,
                displayName: schema.userProfiles.displayName,
            }).from(schema.userProfiles).where(
                inArray(schema.userProfiles.id, senderIds)
            );
            allProfiles.forEach(p => profilesMap.set(p.id, p.displayName || 'Unknown'));
        }

        const list = records.map(r => ({
            id: r.id,
            senderId: r.senderId,
            senderName: profilesMap.get(r.senderId) || 'Unknown',
            type: r.type,
            payload: r.payload,
            status: r.status,
            createdAt: r.updatedAt,
        }));

        return NextResponse.json({ success: true, items: list });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

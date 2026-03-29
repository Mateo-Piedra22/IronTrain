import { and, eq, inArray, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Rate limiting
        const rateLimit = await RATE_LIMITS.SOCIAL_SEARCH(userId);
        if (!rateLimit.ok) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                { 
                    status: 429,
                    headers: { 
                        'Retry-After': String(Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)),
                    }
                }
            );
        }

        const [outboundRecords, inboundRecords] = await Promise.all([
            db.select()
                .from(schema.friendships)
                .where(
                    and(
                        eq(schema.friendships.userId, userId),
                        isNull(schema.friendships.deletedAt)
                    )
                ),
            db.select()
                .from(schema.friendships)
                .where(
                    and(
                        eq(schema.friendships.friendId, userId),
                        isNull(schema.friendships.deletedAt)
                    )
                ),
        ]);

        const records = [...outboundRecords, ...inboundRecords];

        // Collect unique friend IDs
        const userIdsToFetch = new Set<string>();
        records.forEach(r => {
            if (r.userId !== userId) userIdsToFetch.add(r.userId);
            if (r.friendId !== userId) userIdsToFetch.add(r.friendId);
        });

        // Fetch profiles using proper static inArray import
        const profilesMap = new Map<string, { displayName: string | null; username: string | null }>();
        if (userIdsToFetch.size > 0) {
            const allProfiles = await db.select().from(schema.userProfiles).where(
                inArray(schema.userProfiles.id, Array.from(userIdsToFetch))
            );
            allProfiles.forEach(p => profilesMap.set(p.id, p));
        }

        const list = records.map(r => {
            const isSender = r.userId === userId;
            const otherId = isSender ? r.friendId : r.userId;
            const otherProfile = profilesMap.get(otherId) || { displayName: 'Unknown', username: null };
            return {
                id: r.id,
                friendId: otherId,
                displayName: otherProfile.displayName || 'Unknown',
                username: otherProfile.username,
                status: r.status,
                isSender,
            };
        });

        return NextResponse.json({ success: true, friends: list });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

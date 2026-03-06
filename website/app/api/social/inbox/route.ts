import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // 1. Fetch direct shares (Inbox)
        const shareRecords = await db.select()
            .from(schema.sharesInbox)
            .where(
                and(
                    eq(schema.sharesInbox.receiverId, userId),
                    isNull(schema.sharesInbox.deletedAt)
                )
            )
            .orderBy(desc(schema.sharesInbox.updatedAt))
            .limit(50);

        // 2. Fetch accepted friends to get their activity
        const friends = await db.select().from(schema.friendships).where(
            and(
                or(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, userId)),
                eq(schema.friendships.status, 'accepted'),
                isNull(schema.friendships.deletedAt)
            )
        );
        const friendIds = friends.map(r => r.userId === userId ? r.friendId : r.userId);
        const feedUsers = [userId, ...friendIds];

        // 3. Fetch Activity Feed for these users
        let activityRecords: typeof schema.activityFeed.$inferSelect[] = [];
        let kudosCounts: any[] = [];
        let userKudos: any[] = [];

        if (feedUsers.length > 0) {
            activityRecords = await db.select().from(schema.activityFeed)
                .where(
                    and(
                        inArray(schema.activityFeed.userId, feedUsers),
                        isNull(schema.activityFeed.deletedAt)
                    )
                )
                .orderBy(desc(schema.activityFeed.createdAt))
                .limit(50); // Get latest 50 activities overall

            const activityIds = activityRecords.map(a => a.id);
            if (activityIds.length > 0) {
                // Get total kudos per activity
                kudosCounts = await db.select({
                    feedId: schema.kudos.feedId,
                    count: sql<number>`count(${schema.kudos.id})`.mapWith(Number),
                })
                    .from(schema.kudos)
                    .where(and(
                        inArray(schema.kudos.feedId, activityIds),
                        isNull(schema.kudos.deletedAt)
                    ))
                    .groupBy(schema.kudos.feedId);

                // Determine if THIS user gave kudos
                userKudos = await db.select({ feedId: schema.kudos.feedId })
                    .from(schema.kudos)
                    .where(and(
                        inArray(schema.kudos.feedId, activityIds),
                        eq(schema.kudos.giverId, userId),
                        isNull(schema.kudos.deletedAt)
                    ));
            }
        }

        // Fetch display names for everyone
        const allUserIds = [...new Set([
            ...shareRecords.map(r => r.senderId),
            ...activityRecords.map(a => a.userId)
        ])];

        const profilesMap = new Map<string, { name: string, username: string | null }>();

        if (allUserIds.length > 0) {
            const allProfiles = await db.select({
                id: schema.userProfiles.id,
                displayName: schema.userProfiles.displayName,
                username: schema.userProfiles.username,
            }).from(schema.userProfiles).where(
                inArray(schema.userProfiles.id, allUserIds)
            );
            allProfiles.forEach(p => profilesMap.set(p.id, {
                name: p.displayName || 'Unknown',
                username: p.username
            }));
        }

        const kudoCountMap = new Map(kudosCounts.map(k => [k.feedId, k.count]));
        const userKudosSet = new Set(userKudos.map(k => k.feedId));

        const list = [
            ...shareRecords.map(r => ({
                id: r.id,
                feedType: 'direct_share',
                senderId: r.senderId,
                senderName: profilesMap.get(r.senderId)?.name || 'Unknown',
                senderUsername: profilesMap.get(r.senderId)?.username,
                type: r.type,
                payload: r.payload,
                status: r.status,
                createdAt: r.updatedAt,
            })),
            ...activityRecords.map(a => ({
                id: a.id,
                feedType: 'activity_log',
                senderId: a.userId,
                senderName: profilesMap.get(a.userId)?.name || 'Unknown',
                senderUsername: profilesMap.get(a.userId)?.username,
                actionType: a.actionType,
                metadata: a.metadata,
                kudosCount: kudoCountMap.get(a.id) || 0,
                hasKudoed: userKudosSet.has(a.id),
                createdAt: a.createdAt,
            }))
        ];

        // Sort combined list by date descending
        list.sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt as string).getTime();
            const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt as string).getTime();
            return dateB - dateA;
        });

        return NextResponse.json({ success: true, items: list });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

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
        let activityRecords: { activity: typeof schema.activityFeed.$inferSelect, seenAt: Date | null }[] = [];
        let kudosCounts: any[] = [];
        let userKudos: any[] = [];

        if (feedUsers.length > 0) {
            activityRecords = await db.select({
                activity: schema.activityFeed,
                seenAt: schema.activitySeen.seenAt
            })
                .from(schema.activityFeed)
                .leftJoin(schema.activitySeen, and(
                    eq(schema.activitySeen.activityId, schema.activityFeed.id),
                    eq(schema.activitySeen.userId, userId)
                ))
                .where(
                    and(
                        inArray(schema.activityFeed.userId, feedUsers),
                        isNull(schema.activityFeed.deletedAt)
                    )
                )
                .orderBy(desc(schema.activityFeed.createdAt))
                .limit(50); // Get latest 50 activities overall

            const activityIds = activityRecords.map(a => a.activity.id);
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
            ...activityRecords.map(a => a.activity.userId)
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
                seenAt: r.seenAt,
            })),
            ...activityRecords.map(a => ({
                id: a.activity.id,
                feedType: 'activity_log',
                senderId: a.activity.userId,
                senderName: profilesMap.get(a.activity.userId)?.name || 'Unknown',
                senderUsername: profilesMap.get(a.activity.userId)?.username,
                actionType: a.activity.actionType,
                metadata: a.activity.metadata,
                kudosCount: kudoCountMap.get(a.activity.id) || 0,
                hasKudoed: userKudosSet.has(a.activity.id),
                createdAt: a.activity.createdAt,
                seenAt: a.seenAt || (a.activity.userId === userId ? a.activity.seenAt : null),
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

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { id, feedType } = body;

        if (!id || !feedType) {
            return NextResponse.json({ error: 'Missing id or feedType' }, { status: 400 });
        }

        if (feedType === 'direct_share') {
            await db.update(schema.sharesInbox)
                .set({ seenAt: new Date(), updatedAt: new Date() })
                .where(and(eq(schema.sharesInbox.id, id), eq(schema.sharesInbox.receiverId, userId)));
        } else if (feedType === 'activity_log') {
            // Per-user seen status for shared activities
            const seenId = `${userId}_${id}`;
            await db.insert(schema.activitySeen)
                .values({
                    id: seenId,
                    userId,
                    activityId: id,
                    seenAt: new Date()
                })
                .onConflictDoUpdate({
                    target: schema.activitySeen.id,
                    set: { seenAt: new Date() }
                });

            // Also update the main activity_feed.seenAt if it's our own activity (legacy/simplicity)
            await db.update(schema.activityFeed)
                .set({ seenAt: new Date(), updatedAt: new Date() })
                .where(and(eq(schema.activityFeed.id, id), eq(schema.activityFeed.userId, userId)));
        }

        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

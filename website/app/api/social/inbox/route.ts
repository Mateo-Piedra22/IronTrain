import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ActivityInboxItem = {
    id: string;
    feedType: 'activity_log';
    senderId: string;
    senderName: string;
    senderUsername: string | null;
    actionType: string;
    metadata: unknown;
    kudosCount: number;
    hasKudoed: boolean;
    createdAt: Date | null;
    seenAt: Date | null;
};

type DirectShareInboxItem = {
    id: string;
    feedType: 'direct_share';
    senderId: string;
    senderName: string;
    senderUsername: string | null;
    type: string;
    payload: unknown;
    status: string;
    createdAt: Date | null;
    seenAt: Date | null;
};

type InboxItem = ActivityInboxItem | DirectShareInboxItem;

const markSeenSchema = z.object({
    id: z.string().trim().min(1).max(255),
    feedType: z.enum(['direct_share', 'activity_log']),
});

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const scopeParam = req.nextUrl.searchParams.get('scope');
        const inboxScope: 'all' | 'feed' | 'notifications' =
            scopeParam === 'feed' || scopeParam === 'notifications' ? scopeParam : 'all';
        const shouldIncludeShares = inboxScope !== 'feed';
        const shouldIncludeActivity = inboxScope !== 'notifications';

        const rateLimit = await RATE_LIMITS.SOCIAL_INBOX_READ(userId);
        if (!rateLimit.ok) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)),
                    },
                }
            );
        }

        // 1. Fetch direct shares (Inbox)
        const shareRecords = shouldIncludeShares
            ? await db.select({
                id: schema.sharesInbox.id,
                senderId: schema.sharesInbox.senderId,
                type: schema.sharesInbox.type,
                payload: schema.sharesInbox.payload,
                status: schema.sharesInbox.status,
                updatedAt: schema.sharesInbox.updatedAt,
                seenAt: schema.sharesInbox.seenAt,
            })
                .from(schema.sharesInbox)
                .where(
                    and(
                        eq(schema.sharesInbox.receiverId, userId),
                        isNull(schema.sharesInbox.deletedAt)
                    )
                )
                .orderBy(desc(schema.sharesInbox.updatedAt))
                .limit(50)
            : [];

        // 2. Fetch accepted friends to get their activity
        const feedUsers: string[] = shouldIncludeActivity
            ? await (async () => {
                const [outboundFriends, inboundFriends] = await Promise.all([
                    db.select({
                        userId: schema.friendships.userId,
                        friendId: schema.friendships.friendId,
                    })
                        .from(schema.friendships)
                        .where(
                            and(
                                eq(schema.friendships.userId, userId),
                                eq(schema.friendships.status, 'accepted'),
                                isNull(schema.friendships.deletedAt)
                            )
                        ),
                    db.select({
                        userId: schema.friendships.userId,
                        friendId: schema.friendships.friendId,
                    })
                        .from(schema.friendships)
                        .where(
                            and(
                                eq(schema.friendships.friendId, userId),
                                eq(schema.friendships.status, 'accepted'),
                                isNull(schema.friendships.deletedAt)
                            )
                        ),
                ]);
                const friends = [...outboundFriends, ...inboundFriends];
                const friendIds = friends.map(r => r.userId === userId ? r.friendId : r.userId);
                return [userId, ...friendIds];
            })()
            : [];

        // 3. Build feed and notification streams independently, then merge.
        let activityItems: ActivityInboxItem[] = [];
        let shareItems: DirectShareInboxItem[] = [];

        if (shouldIncludeActivity && feedUsers.length > 0) {
            const activityRecords = await db.select({
                id: schema.activityFeed.id,
                userId: schema.activityFeed.userId,
                actionType: schema.activityFeed.actionType,
                metadata: schema.activityFeed.metadata,
                createdAt: schema.activityFeed.createdAt,
                seenAt: schema.activitySeen.seenAt, // Join from activity_seen
                senderName: schema.userProfiles.displayName,
                senderUsername: schema.userProfiles.username,
            })
                .from(schema.activityFeed)
                .leftJoin(schema.userProfiles, eq(schema.activityFeed.userId, schema.userProfiles.id))
                .leftJoin(schema.activitySeen, 
                    and(
                        eq(schema.activityFeed.id, schema.activitySeen.activityId),
                        eq(schema.activitySeen.userId, userId)
                    )
                )
                .where(
                    and(
                        inArray(schema.activityFeed.userId, feedUsers),
                        isNull(schema.activityFeed.deletedAt)
                    )
                )
                .orderBy(desc(schema.activityFeed.createdAt))
                .limit(50);

            const activityIds = activityRecords.map(r => r.id);
            
            // Batch fetch kudos metadata to avoid N+1 queries
            const kudosMetadataMap = new Map<string, { count: number, hasKudoed: boolean }>();
            if (activityIds.length > 0) {
                const kudosData = await db.select({
                    feedId: schema.kudos.feedId,
                    count: sql<number>`count(*)`.mapWith(Number),
                    userKudo: sql<boolean>`max(case when ${schema.kudos.giverId} = ${userId} then 1 else 0 end) = 1`
                })
                .from(schema.kudos)
                .where(
                    and(
                        inArray(schema.kudos.feedId, activityIds),
                        isNull(schema.kudos.deletedAt)
                    )
                )
                .groupBy(schema.kudos.feedId);

                kudosData.forEach(kd => {
                    if (kd.feedId) kudosMetadataMap.set(kd.feedId, { count: kd.count, hasKudoed: kd.userKudo });
                });
            }

            activityItems = activityRecords.map(a => {
                const meta = kudosMetadataMap.get(a.id) || { count: 0, hasKudoed: false };
                return {
                    id: a.id,
                    feedType: 'activity_log' as const,
                    senderId: a.userId,
                    senderName: a.senderName || 'Unknown',
                    senderUsername: a.senderUsername,
                    actionType: a.actionType,
                    metadata: a.metadata,
                    kudosCount: meta.count,
                    hasKudoed: meta.hasKudoed,
                    createdAt: a.createdAt,
                    seenAt: a.seenAt,
                };
            });
        }

        if (shouldIncludeShares && shareRecords.length > 0) {
            // Fetch Profiles for shares (usually fewer records)
            const senderIds = shouldIncludeShares ? [...new Set(shareRecords.map(r => r.senderId))] : [];
            const profilesMap = new Map<string, { name: string, username: string | null }>();
            
            if (senderIds.length > 0) {
                const shareProfiles = await db.select({
                    id: schema.userProfiles.id,
                    name: schema.userProfiles.displayName,
                    username: schema.userProfiles.username
                }).from(schema.userProfiles).where(inArray(schema.userProfiles.id, senderIds));
                
                shareProfiles.forEach(p => profilesMap.set(p.id, { name: p.name || 'Unknown', username: p.username }));
            }

            shareItems = shareRecords.map(r => ({
                id: r.id,
                feedType: 'direct_share' as const,
                senderId: r.senderId,
                senderName: profilesMap.get(r.senderId)?.name || 'Unknown',
                senderUsername: profilesMap.get(r.senderId)?.username ?? null,
                type: r.type,
                payload: r.payload,
                status: r.status,
                createdAt: r.updatedAt,
                seenAt: r.seenAt,
            }));
        }

        const mergedList: InboxItem[] = [...shareItems, ...activityItems].sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
            const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
            return dateB - dateA;
        });

        // Deduplicate by composite key to avoid collisions between different feed types
        const seenKeys = new Set<string>();
        const finalUniqueList = mergedList.filter(item => {
            const key = `${item.feedType || 'direct_share'}:${item.id}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
        });

        return NextResponse.json({ success: true, items: finalUniqueList.slice(0, 100) });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rateLimit = await RATE_LIMITS.SOCIAL_INBOX_MARK_SEEN(userId);
        if (!rateLimit.ok) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)),
                    },
                }
            );
        }

        const body = await req.json().catch(() => null);
        const parsed = markSeenSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
        }
        const { id, feedType } = parsed.data;

        if (feedType === 'direct_share') {
            await db.update(schema.sharesInbox)
                .set({ seenAt: new Date(), updatedAt: new Date() })
                .where(and(eq(schema.sharesInbox.id, id), eq(schema.sharesInbox.receiverId, userId)));
        } else if (feedType === 'activity_log') {
            const existing = await db.select().from(schema.activitySeen)
                .where(and(eq(schema.activitySeen.activityId, id), eq(schema.activitySeen.userId, userId)))
                .limit(1);

            if (existing.length > 0) {
                await db.update(schema.activitySeen)
                    .set({ seenAt: new Date(), updatedAt: new Date() })
                    .where(eq(schema.activitySeen.id, existing[0].id));
            } else {
                await db.insert(schema.activitySeen).values({
                    id: `seen:${userId}:${id}`,
                    userId: userId,
                    activityId: id,
                    seenAt: new Date(),
                    updatedAt: new Date()
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';

export type SocialDomainVersions = {
    profile: string;
    feed: string;
    notifications: string;
    friends: string;
    leaderboard: string;
};

export type SocialPulsePayload = {
    version: string;
    profileUpdatedAtMs: number;
    latestActivityAtMs: number;
    latestShareAtMs: number;
    latestFriendAtMs: number;
    latestScoreAtMs: number;
    latestFriendProfileAtMs: number;
    latestLeaderboardAtMs: number;
    pendingShareCount: number;
    pendingFriendRequestCount: number;
    domainVersions: SocialDomainVersions;
    serverTimeMs: number;
};

const COUNT_INT_SQL = sql<number>`count(*)::int`;

const toMs = (value: unknown): number => {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export async function computeSocialPulse(userId: string): Promise<SocialPulsePayload> {
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

    const friendIds = [...outboundFriends, ...inboundFriends].map((row) =>
        row.userId === userId ? row.friendId : row.userId
    );
    const feedUsers = Array.from(new Set([userId, ...friendIds]));

    const [profileRow, latestActivityRow, latestShareRow, latestFriendRow, pendingSharesRow, pendingIncomingRow, latestScoreRow, latestFriendProfileRow] = await Promise.all([
        db.select({ updatedAt: schema.userProfiles.updatedAt })
            .from(schema.userProfiles)
            .where(eq(schema.userProfiles.id, userId))
            .limit(1),
        feedUsers.length > 0
            ? db.select({ latestAt: sql<Date | null>`max(${schema.activityFeed.updatedAt})` })
                .from(schema.activityFeed)
                .where(
                    and(
                        inArray(schema.activityFeed.userId, feedUsers),
                        isNull(schema.activityFeed.deletedAt)
                    )
                )
            : Promise.resolve([{ latestAt: null }]),
        db.select({ latestAt: sql<Date | null>`max(${schema.sharesInbox.updatedAt})` })
            .from(schema.sharesInbox)
            .where(
                and(
                    eq(schema.sharesInbox.receiverId, userId),
                    isNull(schema.sharesInbox.deletedAt)
                )
            ),
        db.select({ latestAt: sql<Date | null>`max(${schema.friendships.updatedAt})` })
            .from(schema.friendships)
            .where(
                and(
                    isNull(schema.friendships.deletedAt),
                    or(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, userId))
                )
            ),
        db.select({ count: COUNT_INT_SQL })
            .from(schema.sharesInbox)
            .where(
                and(
                    eq(schema.sharesInbox.receiverId, userId),
                    isNull(schema.sharesInbox.deletedAt),
                    isNull(schema.sharesInbox.seenAt)
                )
            ),
        db.select({ count: COUNT_INT_SQL })
            .from(schema.friendships)
            .where(
                and(
                    eq(schema.friendships.friendId, userId),
                    eq(schema.friendships.status, 'pending'),
                    isNull(schema.friendships.deletedAt)
                )
            ),
        feedUsers.length > 0
            ? db.select({ latestAt: sql<Date | null>`max(${schema.scoreEvents.updatedAt})` })
                .from(schema.scoreEvents)
                .where(
                    and(
                        inArray(schema.scoreEvents.userId, feedUsers),
                        isNull(schema.scoreEvents.deletedAt)
                    )
                )
            : Promise.resolve([{ latestAt: null }]),
        feedUsers.length > 0
            ? db.select({ latestAt: sql<Date | null>`max(${schema.userProfiles.updatedAt})` })
                .from(schema.userProfiles)
                .where(inArray(schema.userProfiles.id, feedUsers))
            : Promise.resolve([{ latestAt: null }]),
    ]);

    const profileUpdatedAtMs = toMs(profileRow[0]?.updatedAt);
    const latestActivityAtMs = toMs(latestActivityRow[0]?.latestAt);
    const latestShareAtMs = toMs(latestShareRow[0]?.latestAt);
    const latestFriendAtMs = toMs(latestFriendRow[0]?.latestAt);
    const latestScoreAtMs = toMs(latestScoreRow[0]?.latestAt);
    const latestFriendProfileAtMs = toMs(latestFriendProfileRow[0]?.latestAt);
    const latestLeaderboardAtMs = Math.max(latestScoreAtMs, latestFriendProfileAtMs);
    const pendingShareCount = pendingSharesRow[0]?.count ?? 0;
    const pendingFriendRequestCount = pendingIncomingRow[0]?.count ?? 0;

    const domainVersions: SocialDomainVersions = {
        profile: `${profileUpdatedAtMs}`,
        feed: `${latestActivityAtMs}`,
        notifications: `${latestShareAtMs}:${pendingShareCount}`,
        friends: `${latestFriendAtMs}:${pendingFriendRequestCount}`,
        leaderboard: `${latestLeaderboardAtMs}:${feedUsers.length}`,
    };

    const version = [
        domainVersions.profile,
        domainVersions.feed,
        domainVersions.notifications,
        domainVersions.friends,
        domainVersions.leaderboard,
    ].join(':');

    return {
        version,
        profileUpdatedAtMs,
        latestActivityAtMs,
        latestShareAtMs,
        latestFriendAtMs,
        latestScoreAtMs,
        latestFriendProfileAtMs,
        latestLeaderboardAtMs,
        pendingShareCount,
        pendingFriendRequestCount,
        domainVersions,
        serverTimeMs: Date.now(),
    };
}

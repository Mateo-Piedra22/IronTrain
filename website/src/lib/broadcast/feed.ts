import { and, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import type { db as drizzleDb } from '../../db';
import * as schema from '../../db/schema';
import { normalizeAnnouncementPriority, normalizeTargeting, sortBroadcastItems } from './normalize';
import type { BroadcastFeedQuery, BroadcastItem } from './types';

type DbClient = typeof drizzleDb;

type SegmentContext = {
    isNewUser: boolean;
    isActiveUser: boolean;
    isInactiveUser: boolean;
    hasReceivedRecentSystem: boolean;
};

function segmentMatches(targetSegment: string | null, ctx: SegmentContext): boolean {
    const segment = (targetSegment || 'all').trim().toLowerCase();
    if (segment === 'all') return true;
    if (segment === 'new') return ctx.isNewUser;
    if (segment === 'active') return ctx.isActiveUser;
    if (segment === 'inactive') return ctx.isInactiveUser;
    if (segment === 'premium') return false;
    return false;
}

function buildAnnouncementItem(row: typeof schema.adminNotifications.$inferSelect): BroadcastItem {
    const targeting = normalizeTargeting({
        targetPlatform: row.targetPlatform,
        targetVersion: row.targetVersion,
        targetSegment: row.targetSegment,
    });

    let actionUrl: string | null = null;
    try {
        if (row.metadata && typeof row.metadata === 'object') {
            const url = (row.metadata as Record<string, unknown>).actionUrl;
            if (typeof url === 'string' && url.trim().length > 0) {
                actionUrl = url.trim().slice(0, 512);
            }
        }
    } catch {
        actionUrl = null;
    }

    return {
        id: row.id,
        kind: 'announcement',
        uiType: (row.type === 'toast' || row.type === 'modal' || row.type === 'system') ? row.type : null,
        title: row.title,
        body: row.message,
        priority: normalizeAnnouncementPriority(row.priority),
        displayMode: (row.displayMode === 'once' || row.displayMode === 'always' || row.displayMode === 'until_closed') ? row.displayMode : null,
        actionUrl,
        targeting,
        lifecycle: {
            startsAt: row.scheduledAt,
            endsAt: row.expiresAt,
            isActive: row.isActive === 1,
        },
        engagement: {
            reactionCount: row.reactionCount ?? 0,
            userReacted: null,
        },
        createdAt: new Date(row.createdAt),
    };
}

function buildChangelogItem(row: typeof schema.changelogs.$inferSelect): BroadcastItem {
    const title = `Versión ${row.version}`;

    let body = '';
    try {
        const items = row.items;
        if (Array.isArray(items)) {
            body = items.map((i) => (typeof i === 'string' ? i : '')).filter(Boolean).slice(0, 12).join('\n');
        }
    } catch {
        body = '';
    }

    const unreleased = row.isUnreleased === 1;

    return {
        id: row.id,
        kind: 'changelog',
        uiType: null,
        title,
        body,
        priority: unreleased ? 5 : 15,
        displayMode: null,
        actionUrl: 'irontrain://changelog',
        targeting: {
            platform: null,
            version: row.version,
            segment: 'all',
        },
        lifecycle: {
            startsAt: row.date,
            endsAt: null,
            isActive: true,
        },
        engagement: {
            reactionCount: row.reactionCount ?? 0,
            userReacted: null,
        },
        createdAt: new Date(row.date),
    };
}

function buildGlobalEventItem(row: typeof schema.globalEvents.$inferSelect, now: Date): BroadcastItem {
    const active = row.isActive === 1 && row.startDate <= now && row.endDate >= now;

    return {
        id: row.id,
        kind: 'global_event',
        uiType: null,
        title: row.name,
        body: `Multiplicador x${row.multiplier}`,
        priority: active ? 35 : 12,
        displayMode: null,
        actionUrl: 'irontrain://social',
        targeting: {
            platform: null,
            version: null,
            segment: 'all',
        },
        lifecycle: {
            startsAt: row.startDate,
            endsAt: row.endDate,
            isActive: active,
        },
        engagement: {
            reactionCount: 0,
            userReacted: null,
        },
        createdAt: new Date(row.updatedAt),
    };
}

export async function buildBroadcastFeed(params: {
    db: DbClient;
    query: BroadcastFeedQuery;
    userId: string | null;
    now?: Date;
}): Promise<{ items: BroadcastItem[] }> {
    const now = params.now ?? new Date();

    const changelogRows = await params.db.select().from(schema.changelogs).orderBy(desc(schema.changelogs.date), desc(schema.changelogs.version));
    const changelogItems = changelogRows
        .filter((c) => params.query.includeUnreleased || c.isUnreleased !== 1)
        .map((c) => buildChangelogItem(c));

    const announcementsRows = await params.db.select()
        .from(schema.adminNotifications)
        .where(
            or(
                eq(schema.adminNotifications.isActive, 1),
                eq(schema.adminNotifications.isActive, 0)
            )
        )
        .orderBy(desc(schema.adminNotifications.createdAt));

    let announcements = announcementsRows
        .filter((n) => n.isActive === 1)
        .filter((n) => n.expiresAt === null || n.expiresAt > now)
        .filter((n) => n.scheduledAt === null || n.scheduledAt <= now)
        .filter((n) => {
            if (!n.targetVersion) return true;
            if (!params.query.version) return false;
            return String(n.targetVersion).trim() === String(params.query.version).trim();
        })
        .filter((n) => {
            const tp = (n.targetPlatform || '').toString().trim().toLowerCase();
            if (!tp) return true;
            if (tp === 'all') return true;
            if (!params.query.platform) return false;
            return tp === params.query.platform;
        });

    if (params.userId) {
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const recentSeen = await params.db.select()
            .from(schema.notificationLogs)
            .where(
                and(
                    eq(schema.notificationLogs.userId, params.userId),
                    eq(schema.notificationLogs.action, 'seen'),
                    gt(schema.notificationLogs.createdAt, oneDayAgo)
                )
            );

        const hasReceivedRecentSystem = recentSeen.length > 0;

        const [profile] = await params.db.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, params.userId));
        const [lastWorkout] = await params.db.select({ date: schema.workouts.date })
            .from(schema.workouts)
            .where(eq(schema.workouts.userId, params.userId))
            .orderBy(desc(schema.workouts.date))
            .limit(1);

        const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
        const fourteenDaysAgo = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);

        const ctx: SegmentContext = {
            isNewUser: profile ? (new Date(profile.updatedAt).getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000) : false,
            isActiveUser: lastWorkout ? (Number(lastWorkout.date) > sevenDaysAgo) : false,
            isInactiveUser: lastWorkout ? (Number(lastWorkout.date) < fourteenDaysAgo) : true,
            hasReceivedRecentSystem,
        };

        announcements = announcements.filter((n) => {
            if (!params.query.isFeed && ctx.hasReceivedRecentSystem && (n.type === 'system' || n.type === 'modal')) {
                return false;
            }
            return segmentMatches(n.targetSegment, ctx);
        });
    }

    const announcementItems = announcements.map((n) => buildAnnouncementItem(n));

    const globalEventRows = await params.db.select().from(schema.globalEvents).orderBy(desc(schema.globalEvents.updatedAt));
    const globalEventItems = globalEventRows.map((e) => buildGlobalEventItem(e, now));

    let items = sortBroadcastItems([...announcementItems, ...changelogItems, ...globalEventItems]);

    if (params.userId) {
        const changelogIds = changelogItems.map(i => i.id);
        const notificationIds = announcementItems.map(i => i.id);

        const [changelogReactionRows, notificationReactionRows] = await Promise.all([
            changelogIds.length > 0
                ? params.db.select()
                    .from(schema.changelogReactions)
                    .where(
                        and(
                            eq(schema.changelogReactions.userId, params.userId),
                            isNull(schema.changelogReactions.deletedAt),
                            inArray(schema.changelogReactions.changelogId, changelogIds)
                        )
                    )
                : Promise.resolve([]),
            notificationIds.length > 0
                ? params.db.select()
                    .from(schema.notificationReactions)
                    .where(
                        and(
                            eq(schema.notificationReactions.userId, params.userId),
                            isNull(schema.notificationReactions.deletedAt),
                            inArray(schema.notificationReactions.notificationId, notificationIds)
                        )
                    )
                : Promise.resolve([]),
        ]);

        const reactedChangelogIds = new Set<string>(
            changelogReactionRows.map((r: any) => r.changelogId as string)
        );
        const reactedAnnouncementIds = new Set<string>(
            notificationReactionRows.map((r: any) => r.notificationId as string)
        );

        items = applyUserReactions(items, {
            reactedAnnouncementIds,
            reactedChangelogIds,
        });
    }

    return { items };
}

export function applyUserReactions(
    items: BroadcastItem[],
    params: {
        reactedAnnouncementIds: ReadonlySet<string>;
        reactedChangelogIds: ReadonlySet<string>;
    }
): BroadcastItem[] {
    return items.map((item) => {
        if (item.kind === 'announcement') {
            return {
                ...item,
                engagement: {
                    ...item.engagement,
                    userReacted: params.reactedAnnouncementIds.has(item.id),
                },
            };
        }

        if (item.kind === 'changelog') {
            return {
                ...item,
                engagement: {
                    ...item.engagement,
                    userReacted: params.reactedChangelogIds.has(item.id),
                },
            };
        }

        return item;
    });
}

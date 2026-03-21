import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { db as drizzleDb } from '../../db';
import * as schema from '../../db/schema';
import { sortBroadcastItems } from './normalize';
import type { BroadcastFeedQuery, BroadcastItem } from './types';

type DbClient = typeof drizzleDb;

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

    const unreleased = row.isUnreleased === true;

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
    const active = row.isActive === true && row.startDate <= now && row.endDate >= now;

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
        .filter((c) => params.query.includeUnreleased || c.isUnreleased !== true)
        .map((c) => buildChangelogItem(c));

    const globalEventRows = await params.db.select().from(schema.globalEvents).orderBy(desc(schema.globalEvents.updatedAt));
    const globalEventItems = globalEventRows.map((e) => buildGlobalEventItem(e, now));

    let items = sortBroadcastItems([...changelogItems, ...globalEventItems]);

    if (params.userId) {
        const changelogIds = changelogItems.map(i => i.id);

        const [changelogReactionRows] = await Promise.all([
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
        ]);

        const reactedChangelogIds = new Set<string>(
            changelogReactionRows.map((r: any) => r.changelogId as string)
        );

        items = applyUserReactions(items, {
            reactedChangelogIds,
        });
    }

    return { items };
}

export function applyUserReactions(
    items: BroadcastItem[],
    params: {
        reactedChangelogIds: ReadonlySet<string>;
    }
): BroadcastItem[] {
    return items.map((item) => {
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

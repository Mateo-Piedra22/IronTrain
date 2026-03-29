import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';

export const runtime = 'nodejs';

type SyncStatusCount = {
    active: number;
    deleted: number;
    total: number;
    checksum: string;
};

const getTableField = (table: unknown, field: string): unknown => {
    if (!table || typeof table !== 'object') return undefined;
    return (table as Record<string, unknown>)[field];
};

type EqLeft = Parameters<typeof eq>[0];

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await RATE_LIMITS.SYNC_STATUS(userId);
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

        const tables = [
            { key: 'categories', table: schema.categories, supportsDelete: true, ownerField: 'userId' },
            { key: 'exercises', table: schema.exercises, supportsDelete: true, ownerField: 'userId' },
            { key: 'workouts', table: schema.workouts, supportsDelete: true, ownerField: 'userId' },
            { key: 'workout_sets', table: schema.workoutSets, supportsDelete: true, ownerField: 'userId' },
            { key: 'routines', table: schema.routines, supportsDelete: true, ownerField: 'userId' },
            { key: 'routine_days', table: schema.routineDays, supportsDelete: true, ownerField: 'userId' },
            { key: 'routine_exercises', table: schema.routineExercises, supportsDelete: true, ownerField: 'userId' },
            { key: 'measurements', table: schema.measurements, supportsDelete: true, ownerField: 'userId' },
            { key: 'goals', table: schema.goals, supportsDelete: true, ownerField: 'userId' },
            { key: 'body_metrics', table: schema.bodyMetrics, supportsDelete: true, ownerField: 'userId' },
            { key: 'plate_inventory', table: schema.plateInventory, supportsDelete: false, ownerField: 'userId' },
            { key: 'settings', table: schema.settings, supportsDelete: false, ownerField: 'userId' },
            { key: 'badges', table: schema.badges, supportsDelete: true, ownerField: 'userId' },
            { key: 'exercise_badges', table: schema.exerciseBadges, supportsDelete: true, ownerField: 'userId' },
            { key: 'user_profiles', table: schema.userProfiles, supportsDelete: false, ownerField: 'id' },
            { key: 'changelog_reactions', table: schema.changelogReactions, supportsDelete: true, ownerField: 'userId' },
            { key: 'kudos', table: schema.kudos, supportsDelete: true, ownerField: 'giverId' },
            { key: 'activity_feed', table: schema.activityFeed, supportsDelete: true, ownerField: 'userId' },
        ] as const;

        const countsEntries = await Promise.all(
            tables.map(async (t) => {
                const ownerColumnUnknown = getTableField(t.table, t.ownerField);
                if (ownerColumnUnknown === undefined) {
                    throw new Error(`Owner field "${t.ownerField}" not found on table "${t.key}"`);
                }
                const ownerColumn = ownerColumnUnknown as EqLeft;
                const ownerClause = eq(ownerColumn, userId);

                const workoutIdColumn = getTableField(t.table, 'workoutId') as unknown;
                const deletedAtColumn = getTableField(t.table, 'deletedAt') as unknown;
                const updatedAtColumn = getTableField(t.table, 'updatedAt') as unknown;
                if (updatedAtColumn === undefined) {
                    throw new Error(`updatedAt field not found on table "${t.key}"`);
                }

                const integrityClause = t.key === 'workout_sets'
                    ? sql`exists (
                        select 1
                        from ${schema.workouts}
                        where ${schema.workouts.id} = ${workoutIdColumn}
                          and ${schema.workouts.userId} = ${userId}
                    )`
                    : sql`true`;

                const [aggregate] = await db
                    .select({
                        activeCount: t.supportsDelete
                            ? sql<number>`count(*) filter (where ${deletedAtColumn} is null)`.mapWith(Number)
                            : sql<number>`count(*)`.mapWith(Number),
                        deletedCount: t.supportsDelete
                            ? sql<number>`count(*) filter (where ${deletedAtColumn} is not null)`.mapWith(Number)
                            : sql<number>`0`.mapWith(Number),
                        latestUpdatedAt: sql<Date | string | null>`max(${updatedAtColumn})`,
                    })
                    .from(t.table)
                    .where(and(ownerClause, integrityClause));

                const activeCount = Number(aggregate?.activeCount || 0);
                const deletedCount = Number(aggregate?.deletedCount || 0);

                let checksum = `${activeCount}:${deletedCount}`;
                if (aggregate?.latestUpdatedAt) {
                    const ts = aggregate.latestUpdatedAt instanceof Date
                        ? aggregate.latestUpdatedAt.getTime()
                        : new Date(aggregate.latestUpdatedAt as string).getTime();
                    if (!Number.isNaN(ts)) checksum += `:${ts}`;
                }

                return [t.key, { 
                    active: activeCount, 
                    deleted: deletedCount, 
                    total: activeCount + deletedCount,
                    checksum
                }] as const;
            })
        );

        const counts = Object.fromEntries(countsEntries) as Record<string, SyncStatusCount>;
        const recordCount = Object.values(counts).reduce((acc, value) => acc + value.active, 0);
        
        // Global sync hash for quick comparison
        const globalChecksum = Object.values(counts)
            .map((value) => value.checksum)
            .join('|');

        return NextResponse.json({
            hasData: recordCount > 0,
            recordCount,
            counts,
            checksum: globalChecksum,
            timestamp: Date.now()
        });

    } catch (e) {
        console.error('Sync Status Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

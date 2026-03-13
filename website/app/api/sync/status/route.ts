import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
            { key: 'notification_reactions', table: schema.notificationReactions, supportsDelete: true, ownerField: 'userId' },
            { key: 'kudos', table: schema.kudos, supportsDelete: true, ownerField: 'giverId' },
            { key: 'activity_feed', table: schema.activityFeed, supportsDelete: true, ownerField: 'userId' },
        ] as const;

        const countsEntries = await Promise.all(
            tables.map(async (t) => {
                const ownerClause = eq((t.table as any)[t.ownerField], userId);

                const integrityClause = t.key === 'workout_sets'
                    ? sql`exists (
                        select 1
                        from ${schema.workouts} w
                        where w.id = ${(t.table as any).workoutId}
                          and w.userId = ${userId}
                    )`
                    : sql`true`;

                const [active] = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(t.table)
                    .where(
                        t.supportsDelete
                            ? and(ownerClause, isNull((t.table as any).deletedAt), integrityClause)
                            : and(ownerClause, integrityClause)
                    );

                const [deleted] = t.supportsDelete
                    ? await db
                        .select({ count: sql<number>`count(*)` })
                        .from(t.table)
                        .where(and(ownerClause, sql`${(t.table as any).deletedAt} is not null`, integrityClause))
                    : [{ count: 0 }];

                const activeCount = Number(active?.count || 0);
                const deletedCount = Number(deleted?.count || 0);
                return [t.key, { active: activeCount, deleted: deletedCount, total: activeCount + deletedCount }] as const;
            })
        );

        const counts = Object.fromEntries(countsEntries);
        const recordCount = Object.values(counts).reduce((acc: number, v: any) => acc + (v?.active || 0), 0);

        return NextResponse.json({
            hasData: recordCount > 0,
            recordCount,
            counts,
        });

    } catch (e) {
        console.error('Sync Status Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tables = [
            { key: 'categories', table: schema.categories, supportsDelete: true },
            { key: 'exercises', table: schema.exercises, supportsDelete: true },
            { key: 'workouts', table: schema.workouts, supportsDelete: true },
            { key: 'workout_sets', table: schema.workoutSets, supportsDelete: true },
            { key: 'routines', table: schema.routines, supportsDelete: true },
            { key: 'routine_days', table: schema.routineDays, supportsDelete: true },
            { key: 'routine_exercises', table: schema.routineExercises, supportsDelete: true },
            { key: 'measurements', table: schema.measurements, supportsDelete: true },
            { key: 'goals', table: schema.goals, supportsDelete: true },
            { key: 'body_metrics', table: schema.bodyMetrics, supportsDelete: true },
            { key: 'plate_inventory', table: schema.plateInventory, supportsDelete: false },
            { key: 'settings', table: schema.settings, supportsDelete: false },
        ] as const;

        const countsEntries = await Promise.all(
            tables.map(async (t) => {
                const [active] = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(t.table)
                    .where(
                        t.supportsDelete
                            ? and(eq((t.table as any).userId, userId), isNull((t.table as any).deletedAt))
                            : eq((t.table as any).userId, userId)
                    );

                const [deleted] = t.supportsDelete
                    ? await db
                        .select({ count: sql<number>`count(*)` })
                        .from(t.table)
                        .where(and(eq((t.table as any).userId, userId), sql`${(t.table as any).deletedAt} is not null`))
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

import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

const toCamelCaseKey = (key: string): string => key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());

const toDateFromAny = (value: unknown): Date | undefined => {
    if (value === null || value === undefined) return undefined;
    if (value instanceof Date) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
    if (typeof value === 'string') {
        const ms = Date.parse(value);
        if (!Number.isNaN(ms)) return new Date(ms);
    }
    return undefined;
};

const normalizeSnapshotRecord = (raw: unknown, userId: string): Record<string, unknown> | null => {
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;
    const out: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(obj)) {
        if (k === 'userId' || k === 'user_id') continue;

        if (k === 'updated_at' || k === 'updatedAt') {
            const d = toDateFromAny(v);
            if (d) out.updatedAt = d;
            continue;
        }

        if (k === 'deleted_at' || k === 'deletedAt') {
            const d = toDateFromAny(v);
            out.deletedAt = d ?? null;
            continue;
        }

        const nextKey = k.includes('_') ? toCamelCaseKey(k) : k;
        out[nextKey] = v;
    }

    out.userId = userId;
    if (!('updatedAt' in out)) {
        out.updatedAt = new Date();
    }

    return out;
};

const normalizeSnapshotArray = <T extends Record<string, unknown>>(
    raw: unknown,
    userId: string,
    requiredKeys: ReadonlyArray<keyof T>
): T[] => {
    const rows: unknown[] = Array.isArray(raw) ? raw : [];
    const out: T[] = [];

    for (const r of rows) {
        const normalized = normalizeSnapshotRecord(r, userId);
        if (!normalized) continue;

        let valid = true;
        for (const key of requiredKeys) {
            if (normalized[key as string] === undefined || normalized[key as string] === null) {
                valid = false;
                break;
            }
        }
        if (!valid) continue;

        out.push(normalized as T);
    }

    return out;
};

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Retrieve full cloud state for user
        const snapshot: Record<string, any[]> = {};

        snapshot.categories = await db.select().from(schema.categories).where(eq(schema.categories.userId, userId));
        snapshot.exercises = await db.select().from(schema.exercises).where(eq(schema.exercises.userId, userId));
        snapshot.workouts = await db.select().from(schema.workouts).where(eq(schema.workouts.userId, userId));
        snapshot.workout_sets = await db.select().from(schema.workoutSets).where(eq(schema.workoutSets.userId, userId));
        snapshot.routines = await db.select().from(schema.routines).where(eq(schema.routines.userId, userId));
        snapshot.routine_days = await db.select().from(schema.routineDays).where(eq(schema.routineDays.userId, userId));
        snapshot.routine_exercises = await db.select().from(schema.routineExercises).where(eq(schema.routineExercises.userId, userId));
        snapshot.measurements = await db.select().from(schema.measurements).where(eq(schema.measurements.userId, userId));
        snapshot.goals = await db.select().from(schema.goals).where(eq(schema.goals.userId, userId));
        snapshot.body_metrics = await db.select().from(schema.bodyMetrics).where(eq(schema.bodyMetrics.userId, userId));
        snapshot.plate_inventory = await db.select().from(schema.plateInventory).where(eq(schema.plateInventory.userId, userId));
        snapshot.settings = await db.select().from(schema.settings).where(eq(schema.settings.userId, userId));

        return NextResponse.json({ success: true, snapshot });
    } catch (e) {
        console.error('Snapshot GET error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { snapshot } = body;

        if (!snapshot || typeof snapshot !== 'object') {
            return NextResponse.json({ error: 'Invalid snapshot payload' }, { status: 400 });
        }

        type CategoryInsert = typeof schema.categories.$inferInsert;
        type ExerciseInsert = typeof schema.exercises.$inferInsert;
        type RoutineInsert = typeof schema.routines.$inferInsert;
        type RoutineDayInsert = typeof schema.routineDays.$inferInsert;
        type RoutineExerciseInsert = typeof schema.routineExercises.$inferInsert;
        type WorkoutInsert = typeof schema.workouts.$inferInsert;
        type WorkoutSetInsert = typeof schema.workoutSets.$inferInsert;
        type MeasurementInsert = typeof schema.measurements.$inferInsert;
        type GoalInsert = typeof schema.goals.$inferInsert;
        type BodyMetricInsert = typeof schema.bodyMetrics.$inferInsert;
        type PlateInventoryInsert = typeof schema.plateInventory.$inferInsert;
        type SettingsInsert = typeof schema.settings.$inferInsert;

        const categories = normalizeSnapshotArray<CategoryInsert>(snapshot.categories, userId, ['id', 'name', 'userId']);
        const exercises = normalizeSnapshotArray<ExerciseInsert>(snapshot.exercises, userId, ['id', 'name', 'userId', 'categoryId', 'type']);
        const routines = normalizeSnapshotArray<RoutineInsert>(snapshot.routines, userId, ['id', 'name', 'userId']);
        const routineDays = normalizeSnapshotArray<RoutineDayInsert>(snapshot.routine_days, userId, ['id', 'name', 'userId', 'routineId', 'orderIndex']);
        const routineExercises = normalizeSnapshotArray<RoutineExerciseInsert>(snapshot.routine_exercises, userId, ['id', 'userId', 'routineDayId', 'exerciseId', 'orderIndex']);
        const workouts = normalizeSnapshotArray<WorkoutInsert>(snapshot.workouts, userId, ['id', 'name', 'userId', 'date', 'startTime']);
        const workoutSets = normalizeSnapshotArray<WorkoutSetInsert>(snapshot.workout_sets, userId, ['id', 'userId', 'workoutId', 'exerciseId']);
        const measurements = normalizeSnapshotArray<MeasurementInsert>(snapshot.measurements, userId, ['id', 'userId', 'date', 'type', 'value', 'unit']);
        const goals = normalizeSnapshotArray<GoalInsert>(snapshot.goals, userId, ['id', 'userId', 'type', 'title', 'targetValue']);
        const bodyMetrics = normalizeSnapshotArray<BodyMetricInsert>(snapshot.body_metrics, userId, ['id', 'userId', 'date']);
        const plateInventory = normalizeSnapshotArray<PlateInventoryInsert>(snapshot.plate_inventory, userId, ['id', 'userId', 'weight', 'count', 'available', 'unit']);
        const settingsRows = normalizeSnapshotArray<SettingsInsert>(snapshot.settings, userId, ['key', 'userId', 'value']);

        await db.delete(schema.workoutSets).where(eq(schema.workoutSets.userId, userId));
        await db.delete(schema.workouts).where(eq(schema.workouts.userId, userId));
        await db.delete(schema.routineExercises).where(eq(schema.routineExercises.userId, userId));
        await db.delete(schema.routineDays).where(eq(schema.routineDays.userId, userId));
        await db.delete(schema.routines).where(eq(schema.routines.userId, userId));
        await db.delete(schema.exercises).where(eq(schema.exercises.userId, userId));
        await db.delete(schema.categories).where(eq(schema.categories.userId, userId));
        await db.delete(schema.measurements).where(eq(schema.measurements.userId, userId));
        await db.delete(schema.goals).where(eq(schema.goals.userId, userId));
        await db.delete(schema.bodyMetrics).where(eq(schema.bodyMetrics.userId, userId));
        await db.delete(schema.plateInventory).where(eq(schema.plateInventory.userId, userId));
        await db.delete(schema.settings).where(eq(schema.settings.userId, userId));

        if (categories.length) await db.insert(schema.categories).values(categories).onConflictDoNothing();
        if (exercises.length) await db.insert(schema.exercises).values(exercises).onConflictDoNothing();
        if (routines.length) await db.insert(schema.routines).values(routines).onConflictDoNothing();
        if (routineDays.length) await db.insert(schema.routineDays).values(routineDays).onConflictDoNothing();
        if (routineExercises.length) await db.insert(schema.routineExercises).values(routineExercises).onConflictDoNothing();
        if (workouts.length) await db.insert(schema.workouts).values(workouts).onConflictDoNothing();
        if (workoutSets.length) await db.insert(schema.workoutSets).values(workoutSets).onConflictDoNothing();
        if (measurements.length) await db.insert(schema.measurements).values(measurements).onConflictDoNothing();
        if (goals.length) await db.insert(schema.goals).values(goals).onConflictDoNothing();
        if (bodyMetrics.length) await db.insert(schema.bodyMetrics).values(bodyMetrics).onConflictDoNothing();
        if (plateInventory.length) await db.insert(schema.plateInventory).values(plateInventory).onConflictDoNothing();
        if (settingsRows.length) await db.insert(schema.settings).values(settingsRows).onConflictDoNothing();

        return NextResponse.json({ success: true });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Internal Server Error';
        console.error('Snapshot POST error:', message);
        return NextResponse.json({ error: 'Internal Server Error', message }, { status: 500 });
    }
}

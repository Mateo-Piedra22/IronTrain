import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { runDbTransaction } from '../../../../src/lib/db-transaction';

export const runtime = 'nodejs';

const toCamelCaseKey = (key: string): string => key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
const scopeSettingsKey = (userId: string, key: string): string => {
    const trimmed = key.trim();
    if (trimmed.startsWith(`${userId}:`)) return trimmed;
    return `${userId}:${trimmed}`;
};
const unscopedSettingsKey = (userId: string, key: string): string => {
    const prefix = `${userId}:`;
    if (key.startsWith(prefix)) return key.slice(prefix.length);
    return key;
};

const toDateFromAny = (value: unknown): Date | undefined => {
    if (value === null || value === undefined) return undefined;
    if (value instanceof Date) return value;
    // Prevent Unix 0 (1970) from being treated as a valid timestamp
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return new Date(value);
    if (typeof value === 'string') {
        const ms = Date.parse(value);
        if (!Number.isNaN(ms) && ms > 0) return new Date(ms);
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

        if (k === 'is_moderated' || k === 'isModerated') continue;
        if (k === 'moderation_message' || k === 'moderationMessage') continue;

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
        const settingsRows = await db.select().from(schema.settings).where(eq(schema.settings.userId, userId));
        snapshot.settings = settingsRows.map((row) => ({ ...row, key: unscopedSettingsKey(userId, row.key) }));
        snapshot.badges = await db.select().from(schema.badges).where(eq(schema.badges.userId, userId));
        snapshot.exercise_badges = await db.select().from(schema.exerciseBadges).where(eq(schema.exerciseBadges.userId, userId));
        snapshot.changelog_reactions = await db.select().from(schema.changelogReactions).where(eq(schema.changelogReactions.userId, userId));
        snapshot.kudos = await db.select().from(schema.kudos).where(eq(schema.kudos.giverId, userId));

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
        type BadgeInsert = typeof schema.badges.$inferInsert;
        type ExerciseBadgeInsert = typeof schema.exerciseBadges.$inferInsert;
        type ChangelogReactionInsert = typeof schema.changelogReactions.$inferInsert;
        type KudosInsert = typeof schema.kudos.$inferInsert;

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
        const settingsRows = normalizeSnapshotArray<SettingsInsert>(snapshot.settings, userId, ['key', 'userId', 'value'])
            .map((row) => ({ ...row, key: scopeSettingsKey(userId, String(row.key || '')) }))
            .filter((row) => String(row.key || '').length > 0);
        const badges = normalizeSnapshotArray<BadgeInsert>(snapshot.badges, userId, ['id', 'userId', 'name', 'color']);
        const exerciseBadges = normalizeSnapshotArray<ExerciseBadgeInsert>(snapshot.exercise_badges, userId, ['id', 'userId', 'exerciseId', 'badgeId']);
        const changelogReactions = normalizeSnapshotArray<ChangelogReactionInsert>(snapshot.changelog_reactions, userId, ['id', 'userId', 'changelogId']);
        const kudos = normalizeSnapshotArray<KudosInsert>(snapshot.kudos, userId, ['id', 'giverId', 'feedId']);

        await runDbTransaction(async (trx) => {
            // Delete existing data for the user
            await trx.delete(schema.workoutSets).where(eq(schema.workoutSets.userId, userId));
            await trx.delete(schema.workouts).where(eq(schema.workouts.userId, userId));
            await trx.delete(schema.routineExercises).where(eq(schema.routineExercises.userId, userId));
            await trx.delete(schema.routineDays).where(eq(schema.routineDays.userId, userId));
            await trx.delete(schema.routines).where(eq(schema.routines.userId, userId));
            await trx.delete(schema.exercises).where(eq(schema.exercises.userId, userId));
            await trx.delete(schema.categories).where(eq(schema.categories.userId, userId));
            await trx.delete(schema.settings).where(eq(schema.settings.userId, userId));
            await trx.delete(schema.goals).where(eq(schema.goals.userId, userId));
            await trx.delete(schema.measurements).where(eq(schema.measurements.userId, userId));
            await trx.delete(schema.bodyMetrics).where(eq(schema.bodyMetrics.userId, userId));
            await trx.delete(schema.plateInventory).where(eq(schema.plateInventory.userId, userId));
            await trx.delete(schema.badges).where(eq(schema.badges.userId, userId));
            await trx.delete(schema.exerciseBadges).where(eq(schema.exerciseBadges.userId, userId));
            await trx.delete(schema.changelogReactions).where(eq(schema.changelogReactions.userId, userId));
            await trx.delete(schema.kudos).where(eq(schema.kudos.giverId, userId));

            // Insert new data
            if (categories.length) await trx.insert(schema.categories).values(categories).onConflictDoNothing();
            if (exercises.length) await trx.insert(schema.exercises).values(exercises).onConflictDoNothing();
            if (routines.length) await trx.insert(schema.routines).values(routines).onConflictDoNothing();
            if (routineDays.length) await trx.insert(schema.routineDays).values(routineDays).onConflictDoNothing();
            if (routineExercises.length) await trx.insert(schema.routineExercises).values(routineExercises).onConflictDoNothing();
            if (workouts.length) await trx.insert(schema.workouts).values(workouts).onConflictDoNothing();
            if (workoutSets.length) await trx.insert(schema.workoutSets).values(workoutSets).onConflictDoNothing();
            if (measurements.length) await trx.insert(schema.measurements).values(measurements).onConflictDoNothing();
            if (goals.length) await trx.insert(schema.goals).values(goals).onConflictDoNothing();
            if (bodyMetrics.length) await trx.insert(schema.bodyMetrics).values(bodyMetrics).onConflictDoNothing();
            if (plateInventory.length) await trx.insert(schema.plateInventory).values(plateInventory).onConflictDoNothing();
            if (settingsRows.length) await trx.insert(schema.settings).values(settingsRows).onConflictDoNothing();
            if (badges.length) await trx.insert(schema.badges).values(badges).onConflictDoNothing();
            if (exerciseBadges.length) await trx.insert(schema.exerciseBadges).values(exerciseBadges).onConflictDoNothing();
            if (changelogReactions.length) await trx.insert(schema.changelogReactions).values(changelogReactions).onConflictDoNothing();
            if (kudos.length) await trx.insert(schema.kudos).values(kudos).onConflictDoNothing();
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Internal Server Error';
        console.error('Snapshot POST error:', message);
        return NextResponse.json({ error: 'Internal Server Error', message }, { status: 500 });
    }
}

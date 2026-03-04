import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
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

        // Wipe all user data transactionally
        await db.transaction(async (tx) => {
            // Delete in reverse dependency order
            await tx.delete(schema.workoutSets).where(eq(schema.workoutSets.userId, userId));
            await tx.delete(schema.workouts).where(eq(schema.workouts.userId, userId));
            await tx.delete(schema.routineExercises).where(eq(schema.routineExercises.userId, userId));
            await tx.delete(schema.routineDays).where(eq(schema.routineDays.userId, userId));
            await tx.delete(schema.routines).where(eq(schema.routines.userId, userId));
            await tx.delete(schema.exercises).where(eq(schema.exercises.userId, userId));
            await tx.delete(schema.categories).where(eq(schema.categories.userId, userId));
            await tx.delete(schema.measurements).where(eq(schema.measurements.userId, userId));
            await tx.delete(schema.goals).where(eq(schema.goals.userId, userId));

            // Insert new data
            if (snapshot.categories?.length) await tx.insert(schema.categories).values(snapshot.categories).onConflictDoNothing();
            if (snapshot.exercises?.length) await tx.insert(schema.exercises).values(snapshot.exercises).onConflictDoNothing();
            if (snapshot.routines?.length) await tx.insert(schema.routines).values(snapshot.routines).onConflictDoNothing();
            if (snapshot.routine_days?.length) await tx.insert(schema.routineDays).values(snapshot.routine_days).onConflictDoNothing();
            if (snapshot.routine_exercises?.length) await tx.insert(schema.routineExercises).values(snapshot.routine_exercises).onConflictDoNothing();
            if (snapshot.workouts?.length) await tx.insert(schema.workouts).values(snapshot.workouts).onConflictDoNothing();
            if (snapshot.workout_sets?.length) await tx.insert(schema.workoutSets).values(snapshot.workout_sets).onConflictDoNothing();
            if (snapshot.measurements?.length) await tx.insert(schema.measurements).values(snapshot.measurements).onConflictDoNothing();
            if (snapshot.goals?.length) await tx.insert(schema.goals).values(snapshot.goals).onConflictDoNothing();
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Snapshot POST error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

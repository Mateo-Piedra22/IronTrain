import { and, eq, inArray, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';

const toSnakeCase = (camelObj: Record<string, unknown>): Record<string, unknown> => {
    if (!camelObj || typeof camelObj !== 'object') return camelObj;
    const snakeObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(camelObj)) {
        if (value instanceof Date) {
            snakeObj[key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)] = value.getTime();
            continue;
        }
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        snakeObj[snakeKey] = value;
    }
    // Remove internal fields
    delete snakeObj.user_id;
    return snakeObj;
};

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
        return NextResponse.json({ error: 'Invalid routine ID' }, { status: 400 });
    }

    try {
        // 1. Fetch Routine
        const routines = await db.select().from(schema.routines).where(
            and(eq(schema.routines.id, id), isNull(schema.routines.deletedAt))
        );
        const routine = routines[0];

        if (!routine) {
            return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
        }

        // 2. Fetch Days
        const routineDays = await db.select()
            .from(schema.routineDays)
            .where(and(eq(schema.routineDays.routineId, id), isNull(schema.routineDays.deletedAt)))
            .orderBy(schema.routineDays.orderIndex);

        const daysIds = routineDays.map(d => d.id);

        // 3. Fetch Routine Exercises using proper inArray (fixes N+1)
        let routineExercises: typeof schema.routineExercises.$inferSelect[] = [];
        if (daysIds.length > 0) {
            routineExercises = await db.select()
                .from(schema.routineExercises)
                .where(
                    and(
                        inArray(schema.routineExercises.routineDayId, daysIds),
                        isNull(schema.routineExercises.deletedAt)
                    )
                );
        }

        // 4. Fetch actual Exercise metadata using proper inArray (fixes N+1)
        const exerciseIds = [...new Set(routineExercises.map(re => re.exerciseId))];
        let exercises: typeof schema.exercises.$inferSelect[] = [];
        if (exerciseIds.length > 0) {
            exercises = await db.select()
                .from(schema.exercises)
                .where(
                    and(
                        inArray(schema.exercises.id, exerciseIds),
                        isNull(schema.exercises.deletedAt)
                    )
                );
        }

        // Return fully packaged JSON payload for Mobile P2P consumption
        const payload = {
            routine: toSnakeCase(routine as unknown as Record<string, unknown>),
            routine_days: routineDays.map(d => toSnakeCase(d as unknown as Record<string, unknown>)),
            routine_exercises: routineExercises.map(re => toSnakeCase(re as unknown as Record<string, unknown>)),
            exercises: exercises.map(ex => toSnakeCase(ex as unknown as Record<string, unknown>)),
        };

        return NextResponse.json({ success: true, data: payload });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('Share Routine Error:', message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

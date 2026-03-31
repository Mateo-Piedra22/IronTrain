import { and, eq, inArray, isNull } from 'drizzle-orm';
import * as schema from '../db/schema';

type DbLike = {
    select: (...args: any[]) => any;
};

const toSnakeCaseRecord = (input: Record<string, unknown>): Record<string, unknown> => {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
        const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        if (value instanceof Date) {
            output[snakeKey] = value.toISOString();
            continue;
        }
        output[snakeKey] = value;
    }
    delete output.user_id;
    return output;
};

export async function buildRoutineSharePayloadForUser(
    dbLike: DbLike,
    userId: string,
    routineId: string,
): Promise<Record<string, unknown>> {
    const routines = await dbLike.select().from(schema.routines).where(
        and(
            eq(schema.routines.id, routineId),
            eq(schema.routines.userId, userId),
            isNull(schema.routines.deletedAt),
        ),
    );

    const routine = routines[0];
    if (!routine) {
        throw new Error('Routine not found or unauthorized');
    }

    const routineDays = await dbLike
        .select()
        .from(schema.routineDays)
        .where(
            and(
                eq(schema.routineDays.routineId, routineId),
                eq(schema.routineDays.userId, userId),
                isNull(schema.routineDays.deletedAt),
            ),
        );

    const dayIds = routineDays
        .map((day: any) => (typeof day.id === 'string' ? day.id : null))
        .filter((id: string | null): id is string => Boolean(id));

    const routineExercises = dayIds.length
        ? await dbLike
            .select()
            .from(schema.routineExercises)
            .where(
                and(
                    inArray(schema.routineExercises.routineDayId, dayIds),
                    eq(schema.routineExercises.userId, userId),
                    isNull(schema.routineExercises.deletedAt),
                ),
            )
        : [];

    const exerciseIds: string[] = Array.from(
        new Set(
            routineExercises
                .map((entry: any) => (typeof entry.exerciseId === 'string' ? entry.exerciseId : null))
                .filter((id: string | null): id is string => Boolean(id)),
        ),
    );

    const exercises = exerciseIds.length
        ? await dbLike
            .select()
            .from(schema.exercises)
            .where(
                and(
                    inArray(schema.exercises.id, exerciseIds),
                    eq(schema.exercises.userId, userId),
                    isNull(schema.exercises.deletedAt),
                ),
            )
        : [];

    const categoryIds: string[] = Array.from(
        new Set(
            exercises
                .map((exercise: any) => (typeof exercise.categoryId === 'string' ? exercise.categoryId : null))
                .filter((id: string | null): id is string => Boolean(id)),
        ),
    );

    const categories = categoryIds.length
        ? await dbLike
            .select()
            .from(schema.categories)
            .where(
                and(
                    inArray(schema.categories.id, categoryIds),
                    eq(schema.categories.userId, userId),
                    isNull(schema.categories.deletedAt),
                ),
            )
        : [];

    const exerciseBadges = exerciseIds.length
        ? await dbLike
            .select()
            .from(schema.exerciseBadges)
            .where(
                and(
                    inArray(schema.exerciseBadges.exerciseId, exerciseIds),
                    eq(schema.exerciseBadges.userId, userId),
                    isNull(schema.exerciseBadges.deletedAt),
                ),
            )
        : [];

    const badgeIds: string[] = Array.from(
        new Set(
            exerciseBadges
                .map((entry: any) => (typeof entry.badgeId === 'string' ? entry.badgeId : null))
                .filter((id: string | null): id is string => Boolean(id)),
        ),
    );

    const badges = badgeIds.length
        ? await dbLike
            .select()
            .from(schema.badges)
            .where(
                and(
                    inArray(schema.badges.id, badgeIds),
                    eq(schema.badges.userId, userId),
                    isNull(schema.badges.deletedAt),
                ),
            )
        : [];

    return {
        routine: toSnakeCaseRecord(routine as Record<string, unknown>),
        routine_days: routineDays.map((day: any) => toSnakeCaseRecord(day as Record<string, unknown>)),
        routine_exercises: routineExercises.map((entry: any) => toSnakeCaseRecord(entry as Record<string, unknown>)),
        exercises: exercises.map((exercise: any) => toSnakeCaseRecord(exercise as Record<string, unknown>)),
        categories: categories.map((category: any) => toSnakeCaseRecord(category as Record<string, unknown>)),
        badges: badges.map((badge: any) => toSnakeCaseRecord(badge as Record<string, unknown>)),
        exercise_badges: exerciseBadges.map((entry: any) => toSnakeCaseRecord(entry as Record<string, unknown>)),
    };
}

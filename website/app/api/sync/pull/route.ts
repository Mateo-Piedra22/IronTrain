import { and, eq, gt } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

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
    // Remove internal fields that should not leak to offline clients
    delete snakeObj.user_id;
    return snakeObj;
};

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        const sinceParam = url.searchParams.get('since') || '0';
        const sinceMs = parseInt(sinceParam, 10);
        if (isNaN(sinceMs) || sinceMs < 0) {
            return NextResponse.json({ error: 'Invalid since parameter' }, { status: 400 });
        }
        const timestampMarker = new Date(sinceMs);

        const tableMap: Record<string, any> = {
            'categories': schema.categories,
            'exercises': schema.exercises,
            'workouts': schema.workouts,
            'workout_sets': schema.workoutSets,
            'routines': schema.routines,
            'routine_days': schema.routineDays,
            'routine_exercises': schema.routineExercises,
            'measurements': schema.measurements,
            'goals': schema.goals,
        };

        const changes: Array<{ table: string; operation: string; payload: Record<string, unknown> }> = [];

        // Fix: Use WHERE clause to filter by userId AND timestamp in the DB query
        // instead of fetching all records and filtering in JS (N+1 elimination)
        for (const [tableName, tableSchema] of Object.entries(tableMap)) {
            const records = await db.select()
                .from(tableSchema)
                .where(
                    and(
                        eq(tableSchema.userId, userId),
                        gt(tableSchema.updatedAt, timestampMarker)
                    )
                );

            for (const record of records) {
                if (record.deletedAt && new Date(record.deletedAt) > timestampMarker) {
                    changes.push({
                        table: tableName,
                        operation: 'DELETE',
                        payload: { id: record.id },
                    });
                } else if (!record.deletedAt) {
                    changes.push({
                        table: tableName,
                        operation: 'UPDATE',
                        payload: toSnakeCase(record as Record<string, unknown>),
                    });
                }
            }
        }

        return NextResponse.json({ success: true, changes });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('Sync Pull Error:', message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

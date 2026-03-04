import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

// Convert snake_case from SQLite payload to camelCase for Drizzle
const toCamelCase = (snakeObj: any) => {
    if (!snakeObj || typeof snakeObj !== 'object') return snakeObj;
    const camelObj: any = {};
    for (const [key, value] of Object.entries(snakeObj)) {
        const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        camelObj[camelKey] = value;
    }
    return camelObj;
};

// Main POST handler
export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { operations } = body;

        if (!operations || !Array.isArray(operations)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        // Apply LWW strategies mapping tables to schemas
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

        const results = [];

        for (const op of operations) {
            const tableSchema = tableMap[op.table];
            if (!tableSchema) {
                results.push({ id: op.id, status: 'ignored_unsupported_table' });
                continue;
            }

            try {
                if (op.operation === 'INSERT' || op.operation === 'UPDATE') {
                    const camelPayload = toCamelCase(op.payload);
                    camelPayload.userId = userId as string;
                    camelPayload.updatedAt = new Date(op.timestamp);

                    // Insert or replace based on conflicting IDs
                    await db.insert(tableSchema)
                        .values(camelPayload)
                        .onConflictDoUpdate({
                            target: tableSchema.id,
                            set: camelPayload,
                            // Last Write Wins Reconciliation
                            where: sql`${tableSchema.updatedAt} < ${camelPayload.updatedAt.toISOString()}`
                        });

                } else if (op.operation === 'DELETE') {
                    // Soft delete for enterprise
                    await db.update(tableSchema)
                        .set({ deletedAt: new Date(op.timestamp), updatedAt: new Date(op.timestamp) })
                        .where(and(eq(tableSchema.id, op.recordId), eq(tableSchema.userId, userId as string)));
                }

                results.push({ id: op.id, status: 'success' });
            } catch (err: any) {
                console.error(`Mutation error on ops ID ${op.id} [${op.table}]:`, err.message);
                results.push({ id: op.id, status: 'error', reason: err.message });
            }
        }

        return NextResponse.json({ success: true, processed: results.length, results });

    } catch (error: any) {
        console.error('Fatal Sync Push Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

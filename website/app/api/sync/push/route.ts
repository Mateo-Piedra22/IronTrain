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

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const operations = (body as any)?.operations;
        if (!Array.isArray(operations)) {
            return NextResponse.json({ error: 'Invalid payload: operations must be an array' }, { status: 400 });
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

        for (const op of operations as any[]) {
            const table = typeof op?.table === 'string' ? op.table : null;
            const operation = typeof op?.operation === 'string' ? op.operation : null;
            const recordId = typeof op?.recordId === 'string' ? op.recordId : null;
            const timestamp = typeof op?.timestamp === 'number' ? op.timestamp : null;
            const payload = op?.payload && typeof op.payload === 'object' ? op.payload : null;

            if (!table || !operation || !recordId || timestamp === null) {
                results.push({ id: op?.id ?? null, status: 'error', reason: 'Invalid operation shape' });
                continue;
            }

            const tableSchema = tableMap[table];
            if (!tableSchema) {
                results.push({ id: op?.id ?? null, status: 'ignored_unsupported_table' });
                continue;
            }

            try {
                if (op.operation === 'INSERT' || op.operation === 'UPDATE') {
                    if (!payload) {
                        results.push({ id: op?.id ?? null, status: 'error', reason: 'Missing payload' });
                        continue;
                    }

                    const camelPayload = toCamelCase(payload);
                    camelPayload.userId = userId as string;
                    camelPayload.updatedAt = new Date(timestamp);

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
                        .set({ deletedAt: new Date(timestamp), updatedAt: new Date(timestamp) })
                        .where(and(eq(tableSchema.id, recordId), eq(tableSchema.userId, userId as string)));
                }

                results.push({ id: op.id, status: 'success' });
            } catch (err: any) {
                console.error(`Mutation error on ops ID ${op.id} [${op.table}]:`, err.message);
                results.push({ id: op.id, status: 'error', reason: err.message });
            }
        }

        return NextResponse.json({ success: true, processed: results.length, results });

    } catch (error: any) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('Fatal Sync Push Error:', message);
        return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
    }
}

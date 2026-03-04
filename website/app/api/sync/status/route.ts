import { eq, sql } from 'drizzle-orm';
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

        // Check if user has data in neon
        const [workoutsInfo, routinesInfo, exercisesInfo] = await Promise.all([
            db.select({ count: sql<number>`count(*)` }).from(schema.workouts).where(eq(schema.workouts.userId, userId)),
            db.select({ count: sql<number>`count(*)` }).from(schema.routines).where(eq(schema.routines.userId, userId)),
            db.select({ count: sql<number>`count(*)` }).from(schema.exercises).where(eq(schema.exercises.userId, userId)),
        ]);

        const totalRecords = (workoutsInfo[0]?.count || 0) + (routinesInfo[0]?.count || 0) + (exercisesInfo[0]?.count || 0);

        return NextResponse.json({
            hasData: totalRecords > 0,
            recordCount: totalRecords,
            counts: {
                workouts: workoutsInfo[0]?.count || 0,
                routines: routinesInfo[0]?.count || 0,
                exercises: exercisesInfo[0]?.count || 0,
            }
        });

    } catch (e) {
        console.error('Sync Status Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

import { createHash, randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

const RATE_ACTION = 'wipe';
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 2;

const hashIp = (ip: string): string => createHash('sha256').update(ip).digest('hex');

const getIp = (req: NextRequest): string => {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
        const first = forwarded.split(',')[0]?.trim();
        if (first) return first;
    }
    return '0.0.0.0';
};

export async function POST(req: NextRequest) {
    const auditId = randomUUID();

    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const ip = getIp(req);
        const ipHash = hashIp(ip);
        const userAgent = req.headers.get('user-agent') || undefined;

        const rateKey = `${userId}:${RATE_ACTION}`;
        const existing = await db.select().from(schema.syncRateLimits).where(eq(schema.syncRateLimits.key, rateKey));
        const row = existing[0];

        const now = Date.now();
        const windowStart = row?.windowStartAt instanceof Date ? row.windowStartAt.getTime() : row?.windowStartAt ? new Date(row.windowStartAt as any).getTime() : 0;
        const inWindow = windowStart > 0 && now - windowStart < WINDOW_MS;
        const nextCount = inWindow ? (row?.count ?? 0) + 1 : 1;

        if (inWindow && (row?.count ?? 0) >= MAX_PER_WINDOW) {
            await db.insert(schema.wipeAudit).values({
                id: auditId,
                userId,
                ipHash,
                userAgent,
                status: 'rate_limited',
                errorMessage: 'Rate limited',
            });
            return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
        }

        await db.insert(schema.syncRateLimits)
            .values({
                key: rateKey,
                userId,
                action: RATE_ACTION,
                windowStartAt: new Date(inWindow ? windowStart : now),
                count: nextCount,
            })
            .onConflictDoUpdate({
                target: schema.syncRateLimits.key,
                set: {
                    windowStartAt: new Date(inWindow ? windowStart : now),
                    count: nextCount,
                },
            });

        await db.insert(schema.wipeAudit).values({
            id: auditId,
            userId,
            ipHash,
            userAgent,
            status: 'started',
        });

        await db.delete(schema.workoutSets).where(eq(schema.workoutSets.userId, userId));
        await db.delete(schema.workouts).where(eq(schema.workouts.userId, userId));

        await db.delete(schema.routineExercises).where(eq(schema.routineExercises.userId, userId));
        await db.delete(schema.routineDays).where(eq(schema.routineDays.userId, userId));
        await db.delete(schema.routines).where(eq(schema.routines.userId, userId));

        await db.delete(schema.measurements).where(eq(schema.measurements.userId, userId));
        await db.delete(schema.goals).where(eq(schema.goals.userId, userId));
        await db.delete(schema.bodyMetrics).where(eq(schema.bodyMetrics.userId, userId));

        await db.delete(schema.plateInventory).where(eq(schema.plateInventory.userId, userId));
        await db.delete(schema.settings).where(eq(schema.settings.userId, userId));

        await db.delete(schema.exercises).where(eq(schema.exercises.userId, userId));
        await db.delete(schema.categories).where(eq(schema.categories.userId, userId));

        await db.insert(schema.wipeAudit)
            .values({
                id: randomUUID(),
                userId,
                ipHash,
                userAgent,
                status: 'completed',
            });

        return NextResponse.json({ success: true, auditId });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Internal Server Error';
        try {
            const userId = await verifyAuth(req);
            const ipHash = hashIp(getIp(req));
            const userAgent = req.headers.get('user-agent') || undefined;
            if (userId) {
                await db.insert(schema.wipeAudit).values({
                    id: randomUUID(),
                    userId,
                    ipHash,
                    userAgent,
                    status: 'failed',
                    errorMessage: message,
                });
            }
        } catch {
        }
        return NextResponse.json({ error: 'Internal Server Error', message }, { status: 500 });
    }
}

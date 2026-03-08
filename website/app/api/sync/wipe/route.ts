import { createHash, randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { runDbTransaction } from '../../../../src/lib/db-transaction';

export const runtime = 'nodejs';

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

        await runDbTransaction(async (trx) => {
            await trx.delete(schema.workoutSets).where(eq(schema.workoutSets.userId, userId));
            await trx.delete(schema.workouts).where(eq(schema.workouts.userId, userId));
            await trx.delete(schema.routineExercises).where(eq(schema.routineExercises.userId, userId));
            await trx.delete(schema.routineDays).where(eq(schema.routineDays.userId, userId));
            await trx.delete(schema.routines).where(eq(schema.routines.userId, userId));
            await trx.delete(schema.measurements).where(eq(schema.measurements.userId, userId));
            await trx.delete(schema.goals).where(eq(schema.goals.userId, userId));
            await trx.delete(schema.bodyMetrics).where(eq(schema.bodyMetrics.userId, userId));
            await trx.delete(schema.plateInventory).where(eq(schema.plateInventory.userId, userId));
            await trx.delete(schema.settings).where(eq(schema.settings.userId, userId));
            await trx.delete(schema.exerciseBadges).where(eq(schema.exerciseBadges.userId, userId));
            await trx.delete(schema.badges).where(eq(schema.badges.userId, userId));
            await trx.delete(schema.changelogReactions).where(eq(schema.changelogReactions.userId, userId));
            await trx.delete(schema.notificationReactions).where(eq(schema.notificationReactions.userId, userId));
            await trx.delete(schema.kudos).where(eq(schema.kudos.giverId, userId));
            await trx.delete(schema.activityFeed).where(eq(schema.activityFeed.userId, userId));
            await trx.delete(schema.userProfiles).where(eq(schema.userProfiles.id, userId));
            await trx.delete(schema.exercises).where(eq(schema.exercises.userId, userId));
            await trx.delete(schema.categories).where(eq(schema.categories.userId, userId));
        });

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

import { and, eq, isNull, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { runDbTransaction } from '../../../../src/lib/db-transaction';
import { setDbUserContext } from '../../../../src/lib/db-user-context';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';

export const runtime = 'nodejs';

function normalizeHeaders(req: NextRequest) {
    const requestedWith = req.headers.get('x-requested-with');
    const isFromOurApp = req.headers.get('user-agent')?.includes('IronTrain');
    return { requestedWith, isFromOurApp };
}

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { requestedWith, isFromOurApp } = normalizeHeaders(req);
        if (!requestedWith && !isFromOurApp) {
            return NextResponse.json({ error: 'Forbidden: Missing X-Requested-With header' }, { status: 403 });
        }

        const rateLimit = await RATE_LIMITS.SOCIAL_PROFILE_UPDATE(userId);
        if (!rateLimit.ok) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)),
                    },
                }
            );
        }

        const now = new Date();

        await runDbTransaction(async (trx) => {
            await setDbUserContext(trx, userId);
            await trx.update(schema.userProfiles)
                .set({
                    isPublic: false,
                    deletedAt: now,
                    pushToken: null,
                    updatedAt: now,
                })
                .where(eq(schema.userProfiles.id, userId));

            await trx.update(schema.friendships)
                .set({ deletedAt: now, updatedAt: now })
                .where(and(or(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, userId)), isNull(schema.friendships.deletedAt)));

            await trx.update(schema.sharesInbox)
                .set({ deletedAt: now, updatedAt: now })
                .where(and(or(eq(schema.sharesInbox.senderId, userId), eq(schema.sharesInbox.receiverId, userId)), isNull(schema.sharesInbox.deletedAt)));

            await trx.update(schema.activityFeed)
                .set({ deletedAt: now, updatedAt: now })
                .where(and(eq(schema.activityFeed.userId, userId), isNull(schema.activityFeed.deletedAt)));

            await trx.update(schema.kudos)
                .set({ deletedAt: now, updatedAt: now })
                .where(and(eq(schema.kudos.giverId, userId), isNull(schema.kudos.deletedAt)));

            await trx.update(schema.weatherLogs)
                .set({ deletedAt: now, updatedAt: now })
                .where(and(eq(schema.weatherLogs.userId, userId), isNull(schema.weatherLogs.deletedAt)));

            await trx.update(schema.scoreEvents)
                .set({ deletedAt: now, updatedAt: now })
                .where(and(eq(schema.scoreEvents.userId, userId), isNull(schema.scoreEvents.deletedAt)));

            await trx.update(schema.userExercisePrs)
                .set({ deletedAt: now, updatedAt: now })
                .where(and(eq(schema.userExercisePrs.userId, userId), isNull(schema.userExercisePrs.deletedAt)));
        });

        return NextResponse.json({
            success: true,
            message: 'Cuenta desactivada correctamente. Tu perfil quedó privado y tu actividad social fue ocultada.',
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

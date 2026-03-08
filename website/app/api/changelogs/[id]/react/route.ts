import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';
import { runDbTransaction } from '../../../../../src/lib/db-transaction';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = await verifyAuth(request);

        const totalResult = await db.select({ value: count() })
            .from(schema.changelogReactions)
            .where(and(
                eq(schema.changelogReactions.changelogId, id),
                isNull(schema.changelogReactions.deletedAt)
            ));

        let userReacted = false;
        if (userId) {
            const userResult = await db.select()
                .from(schema.changelogReactions)
                .where(and(
                    eq(schema.changelogReactions.changelogId, id),
                    eq(schema.changelogReactions.userId, userId),
                    isNull(schema.changelogReactions.deletedAt)
                ));
            userReacted = userResult.length > 0;
        }

        return NextResponse.json({
            total: totalResult[0].value,
            userReacted
        });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch reactions' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authedUserId = await verifyAuth(request);
        if (!authedUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await params;
        const { type = 'kudos' } = await request.json();

        const reactionId = `${id}-${authedUserId}`;
        const now = new Date();
        let status: 'added' | 'removed' = 'added';

        await runDbTransaction(async (trx) => {
            const [existing] = await trx.select()
                .from(schema.changelogReactions)
                .where(eq(schema.changelogReactions.id, reactionId))
                .limit(1);

            if (existing && existing.deletedAt === null) {
                await trx.update(schema.changelogReactions)
                    .set({ deletedAt: now, updatedAt: now })
                    .where(eq(schema.changelogReactions.id, reactionId));
                await trx.update(schema.changelogs)
                    .set({
                        reactionCount: sql`GREATEST(0, ${schema.changelogs.reactionCount} - 1)`,
                        updatedAt: now,
                    })
                    .where(eq(schema.changelogs.id, id));
                status = 'removed';
                return;
            }

            if (existing) {
                await trx.update(schema.changelogReactions)
                    .set({ type, deletedAt: null, updatedAt: now })
                    .where(eq(schema.changelogReactions.id, reactionId));
            } else {
                await trx.insert(schema.changelogReactions)
                    .values({
                        id: reactionId,
                        changelogId: id,
                        userId: authedUserId,
                        type,
                        createdAt: now,
                        updatedAt: now,
                    });
            }

            await trx.update(schema.changelogs)
                .set({
                    reactionCount: sql`${schema.changelogs.reactionCount} + 1`,
                    updatedAt: now,
                })
                .where(eq(schema.changelogs.id, id));
            status = 'added';
        });

        return NextResponse.json({ status });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to react' }, { status: 500 });
    }
}

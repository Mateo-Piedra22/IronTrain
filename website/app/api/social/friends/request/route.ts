import { and, eq, isNull, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { friendId } = body;

        if (!friendId || typeof friendId !== 'string' || friendId.trim().length === 0) {
            return NextResponse.json({ error: 'Invalid friend ID' }, { status: 400 });
        }

        if (userId === friendId) {
            return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 });
        }

        // Verify target user exists
        const targetProfile = await db.select({ id: schema.userProfiles.id })
            .from(schema.userProfiles)
            .where(eq(schema.userProfiles.id, friendId));

        if (targetProfile.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check existing non-deleted relationship
        const existing = await db.select()
            .from(schema.friendships)
            .where(
                and(
                    or(
                        and(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, friendId)),
                        and(eq(schema.friendships.userId, friendId), eq(schema.friendships.friendId, userId))
                    ),
                    isNull(schema.friendships.deletedAt)
                )
            );

        if (existing.length > 0) {
            const rel = existing[0];
            if (rel.status === 'blocked') {
                return NextResponse.json({ error: 'Cannot add user' }, { status: 403 });
            }
            if (rel.status === 'pending') {
                return NextResponse.json({ error: 'Request is already pending' }, { status: 400 });
            }
            if (rel.status === 'accepted') {
                return NextResponse.json({ error: 'You are already friends' }, { status: 400 });
            }
        }

        // Use Node.js crypto for UUID generation (server-side)
        const newId = crypto.randomUUID();

        await db.insert(schema.friendships).values({
            id: newId,
            userId: userId,
            friendId: friendId,
            status: 'pending',
        });

        return NextResponse.json({ success: true, message: 'Request sent' });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

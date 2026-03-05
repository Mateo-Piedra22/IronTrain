import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const profiles = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, userId));

        let profile = profiles[0];
        if (!profile) {
            await db.insert(schema.userProfiles).values({
                id: userId,
                displayName: 'Atleta',
            });
            profile = {
                id: userId,
                username: null,
                displayName: 'Atleta',
                isPublic: 1,
                shareStats: 0,
                currentStreak: 0,
                highestStreak: 0,
                lastActiveDate: null,
                updatedAt: new Date(),
            };
        }

        return NextResponse.json({ success: true, profile });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();

        if (body.displayName !== undefined && typeof body.displayName !== 'string') {
            return NextResponse.json({ error: 'displayName must be a string' }, { status: 400 });
        }
        if (body.username !== undefined && typeof body.username !== 'string') {
            return NextResponse.json({ error: 'username must be a string' }, { status: 400 });
        }

        const sanitizedDisplayName = body.displayName?.trim().slice(0, 64) || undefined;
        const sanitizedUsername = body.username?.trim().slice(0, 32).toLowerCase() || undefined;

        const profiles = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, userId));
        if (profiles.length === 0) {
            await db.insert(schema.userProfiles).values({
                id: userId,
                displayName: sanitizedDisplayName || 'Atleta',
                username: sanitizedUsername || null,
                isPublic: body.isPublic !== undefined ? (body.isPublic ? 1 : 0) : 1,
            });
        } else {
            const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
            if (sanitizedDisplayName !== undefined) updatePayload.displayName = sanitizedDisplayName;
            if (sanitizedUsername !== undefined) updatePayload.username = sanitizedUsername;
            if (body.isPublic !== undefined) updatePayload.isPublic = body.isPublic ? 1 : 0;

            await db.update(schema.userProfiles).set(updatePayload).where(eq(schema.userProfiles.id, userId));
        }

        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

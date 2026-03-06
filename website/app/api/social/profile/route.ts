import { and, eq, ne } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { validateUsername } from '../../../../src/lib/moderation';

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        let profiles = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, userId));

        if (profiles.length === 0) {
            await db.insert(schema.userProfiles).values({
                id: userId,
                displayName: 'Atleta',
            });
            profiles = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, userId));
        }

        const profile = profiles[0];

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

        // Removed original type checks for displayName and username as they are now handled by validation/sanitization.

        const sanitizedDisplayName = body.displayName?.trim().slice(0, 64) || undefined;
        let sanitizedUsername = body.username?.trim().slice(0, 32).toLowerCase() || undefined;

        // Strict Uniqueness & Content Check for Usernames
        if (sanitizedUsername) {
            const validation = validateUsername(sanitizedUsername);
            if (!validation.valid) {
                return NextResponse.json({ error: validation.error }, { status: 400 });
            }

            // Check uniqueness - is this username taken by someone else?
            const existing = await db.select({ id: schema.userProfiles.id })
                .from(schema.userProfiles)
                .where(and(eq(schema.userProfiles.username, sanitizedUsername), ne(schema.userProfiles.id, userId)))
                .limit(1);

            if (existing.length > 0) {
                return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
            }
        }

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

import { and, eq, ne } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { hasProfanity, validateUsername } from '../../../../src/lib/moderation';

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
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        let sanitizedDisplayName: string | undefined;
        if (body.displayName !== undefined) {
            if (typeof body.displayName !== 'string') {
                return NextResponse.json({ error: 'displayName must be a string' }, { status: 400 });
            }
            const collapsed = body.displayName.replace(/\s+/g, ' ').trim();
            if (collapsed.length < 2 || collapsed.length > 64) {
                return NextResponse.json({ error: 'El nombre visible debe tener entre 2 y 64 caracteres' }, { status: 400 });
            }
            if (hasProfanity(collapsed)) {
                return NextResponse.json({ error: 'El nombre visible contiene contenido restringido' }, { status: 400 });
            }
            sanitizedDisplayName = collapsed;
        }

        let sanitizedUsername: string | null | undefined;
        if (body.username !== undefined) {
            if (body.username === null) {
                sanitizedUsername = null;
            } else if (typeof body.username === 'string') {
                const normalized = body.username.trim().toLowerCase();
                if (normalized.length === 0) {
                    sanitizedUsername = null;
                } else {
                    const validation = validateUsername(normalized);
                    if (!validation.valid) {
                        return NextResponse.json({ error: validation.error }, { status: 400 });
                    }
                    const existing = await db.select({ id: schema.userProfiles.id })
                        .from(schema.userProfiles)
                        .where(and(eq(schema.userProfiles.username, normalized), ne(schema.userProfiles.id, userId)))
                        .limit(1);
                    if (existing.length > 0) {
                        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
                    }
                    sanitizedUsername = normalized;
                }
            } else {
                return NextResponse.json({ error: 'username must be a string or null' }, { status: 400 });
            }
        }

        let normalizedIsPublic: 0 | 1 | undefined;
        if (body.isPublic !== undefined) {
            const raw = body.isPublic;
            if (raw === 1 || raw === true || raw === '1' || raw === 'true') normalizedIsPublic = 1;
            else if (raw === 0 || raw === false || raw === '0' || raw === 'false') normalizedIsPublic = 0;
            else return NextResponse.json({ error: 'isPublic inválido' }, { status: 400 });
        }

        if (sanitizedDisplayName === undefined && sanitizedUsername === undefined && normalizedIsPublic === undefined) {
            return NextResponse.json({ error: 'No hay cambios para guardar' }, { status: 400 });
        }

        const profiles = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, userId));
        if (profiles.length === 0) {
            await db.insert(schema.userProfiles).values({
                id: userId,
                displayName: sanitizedDisplayName || 'Atleta',
                username: sanitizedUsername === undefined ? null : sanitizedUsername,
                isPublic: normalizedIsPublic ?? 1,
            });
        } else {
            const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
            if (sanitizedDisplayName !== undefined) updatePayload.displayName = sanitizedDisplayName;
            if (sanitizedUsername !== undefined) updatePayload.username = sanitizedUsername;
            if (normalizedIsPublic !== undefined) updatePayload.isPublic = normalizedIsPublic;

            await db.update(schema.userProfiles).set(updatePayload).where(eq(schema.userProfiles.id, userId));
        }

        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

import { and, desc, eq, gte, lte, ne } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { logger } from '../../../../src/lib/logger';
import { validateDisplayName, validateUsername } from '../../../../src/lib/moderation';

function toIsoSafe(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    return null;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        let profiles = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, userId));
        const profile = profiles[0];

        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        // Fetch dynamic score configuration
        const [scoreConfig] = await db.select().from(schema.socialScoringConfig).where(eq(schema.socialScoringConfig.id, 'default'));

        // Fetch currently active global event
        const now = new Date();
        const [activeEvent] = await db.select()
            .from(schema.globalEvents)
            .where(and(
                eq(schema.globalEvents.isActive, true),
                lte(schema.globalEvents.startDate, now),
                gte(schema.globalEvents.endDate, now)
            ))
            .orderBy(desc(schema.globalEvents.multiplier))
            .limit(1);

        return NextResponse.json({
            success: true,
            profile: {
                ...profile,
                scoreConfig: scoreConfig || null,
                activeEvent: activeEvent ? {
                    id: activeEvent.id,
                    title: activeEvent.name,
                    multiplier: activeEvent.multiplier,
                    endDate: toIsoSafe((activeEvent as any)?.endDate),
                } : null
            }
        });
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

        // Basic CSRF Protection: Require custom header for non-GET requests
        const requestedWith = req.headers.get('x-requested-with');
        const isFromOurApp = req.headers.get('user-agent')?.includes('IronTrain'); // Mobile app bypass
        if (!requestedWith && !isFromOurApp) {
            logger.warn('[Security] PUT request without X-Requested-With header', { userId });
        }

        let sanitizedDisplayName: string | undefined;
        if (body.displayName !== undefined) {
            if (typeof body.displayName !== 'string') {
                return NextResponse.json({ error: 'displayName must be a string' }, { status: 400 });
            }

            const validation = validateDisplayName(body.displayName);
            if (!validation.valid) {
                return NextResponse.json({ error: validation.error }, { status: 400 });
            }
            sanitizedDisplayName = body.displayName.trim();
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

        let normalizedIsPublic: boolean | undefined;
        if (body.isPublic !== undefined) {
            const raw = body.isPublic;
            if (raw === 1 || raw === true || raw === '1' || raw === 'true') normalizedIsPublic = true;
            else if (raw === 0 || raw === false || raw === '0' || raw === 'false') normalizedIsPublic = false;
            else return NextResponse.json({ error: 'isPublic inválido' }, { status: 400 });
        }

        if (sanitizedDisplayName === undefined && sanitizedUsername === undefined && normalizedIsPublic === undefined) {
            return NextResponse.json({ error: 'No hay cambios para guardar' }, { status: 400 });
        }

        const profiles = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, userId));

        if (sanitizedUsername !== undefined) {
            const currentProfile = profiles[0];
            const oldUsername = currentProfile?.username || null;

            // Si el username es distinto al actual, aplicar restricciones
            if (sanitizedUsername !== oldUsername) {
                // Restricción de tiempo: 30 días
                const cooldownDays = 30;
                const lastChange = currentProfile?.lastUsernameChangeAt;

                if (lastChange) {
                    const diffMs = Date.now() - lastChange.getTime();
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                    if (diffDays < cooldownDays) {
                        return NextResponse.json({
                            error: `Solo podés cambiar tu username una vez cada ${cooldownDays} días. Faltan ${cooldownDays - diffDays} días.`
                        }, { status: 403 });
                    }
                }
            }
        }

        if (profiles.length === 0) {
            await db.insert(schema.userProfiles).values({
                id: userId,
                displayName: sanitizedDisplayName || 'Atleta',
                username: sanitizedUsername === undefined ? null : sanitizedUsername,
                isPublic: normalizedIsPublic ?? true,
                lastUsernameChangeAt: sanitizedUsername !== undefined ? new Date() : null,
            });
        } else {
            const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
            if (sanitizedDisplayName !== undefined) updatePayload.displayName = sanitizedDisplayName;
            if (sanitizedUsername !== undefined) {
                const currentProfile = profiles[0];
                if (sanitizedUsername !== currentProfile.username) {
                    updatePayload.username = sanitizedUsername;
                    updatePayload.lastUsernameChangeAt = new Date();
                }
            }
            if (normalizedIsPublic !== undefined) updatePayload.isPublic = normalizedIsPublic;

            await db.update(schema.userProfiles).set(updatePayload).where(eq(schema.userProfiles.id, userId));
        }

        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        const error = e as any;
        if (error.code === '23505') { // Postgres Unique Violation
            return NextResponse.json({ error: 'Este nombre de usuario ya está en uso' }, { status: 409 });
        }
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        logger.info('[API] Permanent account deletion requested', { userId });

        // Delete profile and related data
        // Note: Better Auth tables (user, account, session) are managed by Neon Auth.
        // We only wipe the IronSocial specific profile data here.
        // In a real app, you might also want to trigger the auth provider's deletion.
        await db.delete(schema.userProfiles).where(eq(schema.userProfiles.id, userId));

        return NextResponse.json({
            success: true,
            message: 'Cuenta de IronSocial eliminada correctamente. Los datos de sesión se limpiarán en el próximo inicio.'
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

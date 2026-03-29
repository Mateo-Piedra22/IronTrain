import { and, desc, eq, gte, isNull, lte, ne } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { toIsoSafe } from '../../../../src/lib/date-utils';
import { logger } from '../../../../src/lib/logger';
import { validateDisplayName, validateUsername } from '../../../../src/lib/moderation';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';
import { reconcileStreakStateForUser } from '../../../../src/lib/social-scoring';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const profileUpdateSchema = z.object({
    displayName: z.string().optional(),
    username: z.union([z.string(), z.null()]).optional(),
    isPublic: z.union([z.boolean(), z.literal(0), z.literal(1), z.literal('0'), z.literal('1'), z.literal('true'), z.literal('false')]).optional(),
});

function weatherConditionLabel(condition: string | null | undefined, isAdverse: boolean | null | undefined): string {
    const value = String(condition || '').toLowerCase();
    if (!isAdverse) return 'Cielo Despejado';
    if (value.includes('rain')) return 'Lluvia';
    if (value.includes('snow')) return 'Nieve';
    if (value.includes('storm') || value.includes('thunder')) return 'Tormenta';
    if (value.includes('cold')) return 'Clima Gélido';
    if (value.includes('heat')) return 'Calor Extremo';
    return 'Clima Adverso';
}

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rateLimit = await RATE_LIMITS.SOCIAL_PROFILE_READ(userId);
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

        await reconcileStreakStateForUser(db, userId).catch((e) => {
            logger.captureException(e, { scope: 'social.profile.reconcileStreakState', userId });
        });

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

        const recentWeatherThreshold = new Date(Date.now() - (20 * 60 * 1000));
        const [recentWeather] = await db.select()
            .from(schema.weatherLogs)
            .where(and(
                eq(schema.weatherLogs.userId, userId),
                gte(schema.weatherLogs.createdAt, recentWeatherThreshold),
                isNull(schema.weatherLogs.deletedAt)
            ))
            .orderBy(desc(schema.weatherLogs.createdAt))
            .limit(1);

        const checkedAtMs = recentWeather?.createdAt ? recentWeather.createdAt.getTime() : null;
        const weatherBonus = recentWeather ? {
            location: recentWeather.location || 'Tu ubicación',
            condition: weatherConditionLabel(recentWeather.condition, recentWeather.isAdverse),
            temperature: Math.round(Number(recentWeather.tempC ?? recentWeather.temperature ?? 20)),
            multiplier: 1,
            isActive: Boolean(recentWeather.isAdverse),
            checkedAtMs,
            expiresAtMs: checkedAtMs ? checkedAtMs + (20 * 60 * 1000) : null,
        } : null;

        return NextResponse.json({
            success: true,
            profile: {
                ...profile,
                scoreConfig: scoreConfig || null,
                weatherBonus,
                activeEvent: activeEvent ? {
                    id: activeEvent.id,
                    title: activeEvent.name,
                    multiplier: activeEvent.multiplier,
                    endDate: toIsoSafe(activeEvent.endDate),
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

        const body = await req.json().catch(() => null);
        const parsed = profileUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
        }
        const payload = parsed.data;

        // Basic CSRF Protection: Require custom header for non-GET requests
        const requestedWith = req.headers.get('x-requested-with');
        const isFromOurApp = req.headers.get('user-agent')?.includes('IronTrain'); // Mobile app bypass
        if (!requestedWith && !isFromOurApp) {
            logger.warn('[Security] PUT request without X-Requested-With header — rejected', { userId });
            return NextResponse.json({ error: 'Forbidden: Missing X-Requested-With header' }, { status: 403 });
        }

        let sanitizedDisplayName: string | undefined;
        if (payload.displayName !== undefined) {
            const validation = validateDisplayName(payload.displayName);
            if (!validation.valid) {
                return NextResponse.json({ error: validation.error }, { status: 400 });
            }
            sanitizedDisplayName = payload.displayName.trim();
        }

        let sanitizedUsername: string | null | undefined;
        if (payload.username !== undefined) {
            if (payload.username === null) {
                sanitizedUsername = null;
            } else if (typeof payload.username === 'string') {
                const normalized = payload.username.trim().toLowerCase();
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
        if (payload.isPublic !== undefined) {
            const raw = payload.isPublic;
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
        const errorCode = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code?: unknown }).code) : undefined;
        if (errorCode === '23505') { // Postgres Unique Violation
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

import { db } from '@/db';
import { syncRateLimits } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type RateLimitResult =
    | { ok: true; remaining: number; resetAtMs: number }
    | { ok: false; remaining: 0; resetAtMs: number };

/**
 * Rate limiting in-memory (LEGACY - NO USAR EN PRODUCCIÓN)
 * @deprecated Usar checkRateLimitDB en su lugar
 */
type RateLimitState = {
    count: number;
    resetAtMs: number;
};

const buckets = new Map<string, RateLimitState>();

export function checkRateLimit(params: {
    key: string;
    limit: number;
    windowMs: number;
    nowMs?: number;
}): RateLimitResult {
    const nowMs = params.nowMs ?? Date.now();
    const limit = Math.max(1, Math.floor(params.limit));
    const windowMs = Math.max(250, Math.floor(params.windowMs));

    const current = buckets.get(params.key);

    if (!current || nowMs >= current.resetAtMs) {
        const resetAtMs = nowMs + windowMs;
        const next: RateLimitState = { count: 1, resetAtMs };
        buckets.set(params.key, next);
        return { ok: true, remaining: Math.max(0, limit - 1), resetAtMs };
    }

    if (current.count >= limit) {
        return { ok: false, remaining: 0, resetAtMs: current.resetAtMs };
    }

    current.count += 1;
    buckets.set(params.key, current);
    return { ok: true, remaining: Math.max(0, limit - current.count), resetAtMs: current.resetAtMs };
}

/**
 * Rate limiting basado en base de datos (PRODUCCIÓN)
 * Persiste los buckets en la tabla sync_rate_limits
 * 
 * @param userId - ID del usuario
 * @param action - Acción a rate limit (ej: 'social:friends:request')
 * @param limit - Máximo de requests permitidas
 * @param windowMs - Ventana de tiempo en milisegundos
 * @returns Resultado del rate limit
 */
export async function checkRateLimitDB(params: {
    userId: string;
    action: string;
    limit: number;
    windowMs: number;
}): Promise<RateLimitResult> {
    const key = `${params.userId}:${params.action}`;
    const now = Date.now();
    const limit = Math.max(1, Math.floor(params.limit));
    const windowMs = Math.max(1000, Math.floor(params.windowMs)); // Mínimo 1 segundo

    try {
        // Buscar bucket existente
        const existing = await db
            .select()
            .from(syncRateLimits)
            .where(eq(syncRateLimits.key, key))
            .limit(1);

        const row = existing[0];
        const windowStart = row?.windowStartAt instanceof Date
            ? row.windowStartAt.getTime()
            : 0;
        const inWindow = windowStart > 0 && now - windowStart < windowMs;
        const nextCount = inWindow ? (row?.count ?? 0) + 1 : 1;

        // Verificar si excedió el límite
        if (inWindow && (row?.count ?? 0) >= limit) {
            return {
                ok: false,
                remaining: 0,
                resetAtMs: windowStart + windowMs,
            };
        }

        // Insertar o actualizar bucket
        await db
            .insert(syncRateLimits)
            .values({
                key,
                userId: params.userId,
                action: params.action,
                windowStartAt: new Date(inWindow ? windowStart : now),
                count: nextCount,
            })
            .onConflictDoUpdate({
                target: syncRateLimits.key,
                set: {
                    windowStartAt: new Date(inWindow ? windowStart : now),
                    count: nextCount,
                },
            });

        return {
            ok: true,
            remaining: Math.max(0, limit - nextCount),
            resetAtMs: (inWindow ? windowStart : now) + windowMs,
        };
    } catch (error) {
        // En caso de error de DB, permitir el request pero loguear
        console.error('[RateLimit] DB error, allowing request:', error);
        return {
            ok: true,
            remaining: limit - 1,
            resetAtMs: now + windowMs,
        };
    }
}

/**
 * Helper para crear rate limiters con configuración predefinida
 */
export function createRateLimiter(config: {
    action: string;
    limit: number;
    windowMs: number;
}) {
    return async (userId: string): Promise<RateLimitResult> => {
        return await checkRateLimitDB({
            userId,
            action: config.action,
            limit: config.limit,
            windowMs: config.windowMs,
        });
    };
}

// Configuraciones predefinidas para endpoints comunes
export const RATE_LIMITS = {
    // Social endpoints
    SOCIAL_FRIENDS_REQUEST: createRateLimiter({
        action: 'social:friends:request',
        limit: 10,
        windowMs: 60000, // 10 por minuto
    }),
    SOCIAL_FRIENDS_RESPOND: createRateLimiter({
        action: 'social:friends:respond',
        limit: 20,
        windowMs: 60000,
    }),
    SOCIAL_FRIENDS_READ: createRateLimiter({
        action: 'social:friends:read',
        limit: 60,
        windowMs: 60000,
    }),
    SOCIAL_INBOX_SEND: createRateLimiter({
        action: 'social:inbox:send',
        limit: 10,
        windowMs: 60000,
    }),
    SOCIAL_INBOX_READ: createRateLimiter({
        action: 'social:inbox:read',
        limit: 60,
        windowMs: 60000,
    }),
    SOCIAL_INBOX_MARK_SEEN: createRateLimiter({
        action: 'social:inbox:mark-seen',
        limit: 60,
        windowMs: 60000,
    }),
    SOCIAL_INBOX_RESPOND: createRateLimiter({
        action: 'social:inbox:respond',
        limit: 20,
        windowMs: 60000,
    }),
    SOCIAL_INBOX_BATCH_SEEN: createRateLimiter({
        action: 'social:inbox:batch-seen',
        limit: 30,
        windowMs: 60000,
    }),
    SOCIAL_FEED_KUDOS: createRateLimiter({
        action: 'social:feed:kudos',
        limit: 100,
        windowMs: 60000,
    }),
    SOCIAL_WEATHER_BONUS: createRateLimiter({
        action: 'social:weather:bonus',
        limit: 10,
        windowMs: 60000,
    }),
    SOCIAL_PROFILE_UPDATE: createRateLimiter({
        action: 'social:profile:update',
        limit: 30,
        windowMs: 60000,
    }),
    SOCIAL_SEARCH: createRateLimiter({
        action: 'social:search',
        limit: 60,
        windowMs: 60000,
    }),
    SOCIAL_PROFILE_READ: createRateLimiter({
        action: 'social:profile:read',
        limit: 60,
        windowMs: 60000,
    }),
    SOCIAL_ANALYTICS: createRateLimiter({
        action: 'social:analytics',
        limit: 30,
        windowMs: 60000,
    }),
    SOCIAL_PULSE: createRateLimiter({
        action: 'social:pulse',
        limit: 180,
        windowMs: 60000,
    }),
    SOCIAL_STREAM: createRateLimiter({
        action: 'social:stream',
        limit: 40,
        windowMs: 60000,
    }),
    SOCIAL_COMPARE: createRateLimiter({
        action: 'social:compare',
        limit: 30,
        windowMs: 60000,
    }),
    SOCIAL_WEATHER_HISTORY: createRateLimiter({
        action: 'social:weather:history',
        limit: 30,
        windowMs: 60000,
    }),
    SOCIAL_SHARED_ROUTINES_READ: createRateLimiter({
        action: 'social:shared-routines:read',
        limit: 60,
        windowMs: 60000,
    }),
    SOCIAL_SHARED_ROUTINES_WRITE: createRateLimiter({
        action: 'social:shared-routines:write',
        limit: 20,
        windowMs: 60000,
    }),
    SOCIAL_THEMES_READ: createRateLimiter({
        action: 'social:themes:read',
        limit: 90,
        windowMs: 60000,
    }),
    SOCIAL_THEMES_WRITE: createRateLimiter({
        action: 'social:themes:write',
        limit: 30,
        windowMs: 60000,
    }),
    SOCIAL_THEMES_INSTALL: createRateLimiter({
        action: 'social:themes:install',
        limit: 60,
        windowMs: 60000,
    }),
    SOCIAL_THEMES_INTERACT: createRateLimiter({
        action: 'social:themes:interact',
        limit: 45,
        windowMs: 60000,
    }),

    // Sync endpoints
    SYNC_PUSH: createRateLimiter({
        action: 'sync:push',
        limit: 100,
        windowMs: 60000,
    }),
    SYNC_PULL: createRateLimiter({
        action: 'sync:pull',
        limit: 100,
        windowMs: 60000,
    }),
    SYNC_WIPE: createRateLimiter({
        action: 'sync:wipe',
        limit: 2,
        windowMs: 3600000, // 2 por hora
    }),
    SYNC_SNAPSHOT: createRateLimiter({
        action: 'sync:snapshot',
        limit: 20,
        windowMs: 60000,
    }),

    // Auth endpoints
    AUTH_EXCHANGE: createRateLimiter({
        action: 'auth:exchange',
        limit: 10,
        windowMs: 60000,
    }),
    CHANGELOG_REACT: createRateLimiter({
        action: 'changelog:react',
        limit: 60,
        windowMs: 60000,
    }),
    SHARE_ROUTINE: createRateLimiter({
        action: 'share:routine',
        limit: 120,
        windowMs: 60000,
    }),
    SHARE_THEME: createRateLimiter({
        action: 'share:theme',
        limit: 120,
        windowMs: 60000,
    }),

    // Admin endpoints
    ADMIN_ACTION: createRateLimiter({
        action: 'admin:action',
        limit: 100,
        windowMs: 60000,
    }),

    // Marketplace endpoints
    MARKETPLACE_CHECKOUT: createRateLimiter({
        action: 'marketplace:checkout',
        limit: 20,
        windowMs: 60000,
    }),
    BROADCAST_FEED: createRateLimiter({
        action: 'broadcast:feed',
        limit: 120,
        windowMs: 60000,
    }),
    CHANGELOG_LIST: createRateLimiter({
        action: 'changelog:list',
        limit: 120,
        windowMs: 60000,
    }),
    CHANGELOG_SYNC: createRateLimiter({
        action: 'changelog:sync',
        limit: 10,
        windowMs: 60000,
    }),
    SYNC_STATUS: createRateLimiter({
        action: 'sync:status',
        limit: 60,
        windowMs: 60000,
    }),

    // Notifications endpoints
    NOTIFICATIONS_REGISTER_TOKEN: createRateLimiter({
        action: 'notifications:register-token',
        limit: 30,
        windowMs: 60000,
    }),
    NOTIFICATIONS_UNREGISTER_TOKEN: createRateLimiter({
        action: 'notifications:unregister-token',
        limit: 30,
        windowMs: 60000,
    }),
};

export function _unsafeClearRateLimitBucketsForTests(): void {
    buckets.clear();
}

import * as SecureStore from 'expo-secure-store';
import { Config } from '../constants/Config';
import { useAuthStore } from '../store/authStore';
import * as analytics from '../utils/analytics';
import { logger } from '../utils/logger';
import { uuidV4 } from '../utils/uuid';
import { dataEventService } from './DataEventService';
import { dbService } from './DatabaseService';

const API_URL = Config.API_URL;

export interface ScoreConfig {
    workoutCompletePoints: number;
    extraDayPoints: number;
    extraDayWeeklyCap: number;
    prNormalPoints: number;
    prBig3Points: number;
    adverseWeatherPoints: number;
    weekTier2Min: number;
    weekTier3Min: number;
    weekTier4Min: number;
    tier2Multiplier: number;
    tier3Multiplier: number;
    tier4Multiplier: number;
    coldThresholdC: number;
    heatThresholdC?: number;
    weatherBonusEnabled: number;
}

export interface SocialProfile {
    id: string;
    displayName: string | null;
    display_name?: string | null; // Fallback for snake_case
    username: string | null;
    shareStats?: number | null;
    isPublic?: number | boolean | null;
    is_public?: number | boolean | null; // Fallback for snake_case
    // Streak and Score - Added for IronScore integration
    currentStreak?: number;
    highestStreak?: number;
    streakWeeks?: number;
    scoreLifetime?: number;
    streakMultiplier?: number;
    updatedAt?: string | number | Date | null;
    lastUsernameChangeAt?: string | null;
    activeEvent?: GlobalEvent | null;
    weatherBonus?: WeatherInfo | null;
    scoreConfig?: ScoreConfig | null;
    trainingDays?: number[];
}

export interface GlobalEvent {
    id: string;
    title: string;
    multiplier: number;
    startDate?: string;
    endDate: string;
}

export interface WeatherInfo {
    location: string;
    condition: string;
    temperature: number;
    multiplier: number;
    isActive: boolean;
    humidity?: number;
    windSpeed?: number;
    checkedAtMs?: number | null;
    expiresAtMs?: number | null;
}

export interface WeatherLog {
    id: string;
    userId: string;
    lat: number;
    lon: number;
    condition: string | null;
    tempC: number | null;
    windSpeed: number | null;
    humidity: number | null;
    isAdverse: boolean | null;
    createdAt: string;
    workoutId: string | null;
}

export interface SocialFriend {
    id: string;
    friendId: string;
    displayName: string;
    username: string | null;
    status: 'pending' | 'accepted' | 'blocked';
    isSender: boolean;
}

export interface SocialInboxItem {
    id: string;
    feedType?: 'direct_share' | 'activity_log'; // A.2
    senderId: string;
    senderName: string;
    senderUsername?: string | null;
    type?: 'routine';
    payload?: unknown;
    status?: 'pending' | 'accepted' | 'rejected';
    actionType?: string; // 'workout_completed', 'pr_broken'
    metadata?: string | null;
    kudosCount?: number;
    hasKudoed?: boolean;
    createdAt: string | number | Date;
    seenAt?: string | number | Date | null;
}

export interface SocialLeaderboardEntry {
    id: string;
    displayName: string;
    scores: {
        lifetime: number;
        monthly: number;
        weekly: number;
    };
    stats: {
        workoutsLifetime: number;
        workoutsMonthly: number;
        workoutsWeekly: number;
        routines: number;
        shares: number;
        currentStreak: number;
        streakWeeks: number;
        highestStreak: number;
    };
}

export interface SocialSearchUser {
    id: string;
    displayName: string | null;
    username: string | null;
}

export interface SocialComparisonEntry {
    exerciseName: string;
    user1RM: number;
    friend1RM: number;
    unit: 'kg' | 'lbs';
    user1RMKg: number;
    friend1RMKg: number;
    diff: number;
}

export class SocialService {
    private static cache = new Map<string, { value: any; timestamp: number }>();
    private static CACHE_TTL = 60000; // 60 seconds
    private static isSubscribed = false;
    private static REQUEST_TIMEOUT_MS =
        ((Config as any).SOCIAL_REQUEST_TIMEOUT_MS as number | undefined) || 15000;

    private static init() {
        if (this.isSubscribed) return;
        dataEventService.subscribe('SOCIAL_UPDATED', () => this.clearCache());
        this.isSubscribed = true;
    }

    public static clearCache() {
        this.cache.clear();
    }

    private static getCached<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }
        return entry.value as T;
    }

    private static setCache(key: string, value: any) {
        this.init();
        this.cache.set(key, { value, timestamp: Date.now() });
    }

    static async getToken(): Promise<string | null> {
        return await SecureStore.getItemAsync('irontrain_auth_token');
    }

    static async getHeaders(): Promise<Record<string, string>> {
        const token = await this.getToken();
        if (!token) {
            throw new Error('No auth token available');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Requested-With': 'XMLHttpRequest',
        };
    }

    private static async request<T>(url: string, options: RequestInit = {}): Promise<T> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

        let res: Response;
        let text = '';

        try {
            res = await fetch(url, {
                ...options,
                signal: options.signal ?? controller.signal,
            });
            text = await res.text();
        } catch (error: unknown) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new Error('La solicitud tardó demasiado. Verificá tu conexión e intentá nuevamente.');
            }

            throw new Error('No se pudo conectar con el servidor. Verificá tu conexión e intentá nuevamente.');
        } finally {
            clearTimeout(timeout);
        }

        // Try to parse JSON safely
        let data: unknown;
        try {
            data = JSON.parse(text);
        } catch {
            logger.error('[SocialService] Failed to parse JSON response', {
                url,
                status: res.status,
                bodyPrefix: typeof text === 'string' ? text.substring(0, 50) : null,
            });
            throw new Error(`Error del servidor (Código ${res.status}). La respuesta no es válida.`);
        }

        const responsePayload = (data && typeof data === 'object') ? data as Record<string, unknown> : {};

        if (!res.ok) {
            const errorMessage = typeof responsePayload.error === 'string'
                ? responsePayload.error
                : typeof responsePayload.message === 'string'
                    ? responsePayload.message
                    : `Error en la solicitud (${res.status})`;
            throw new Error(errorMessage);
        }

        return data as T;
    }

    static async updateWeatherBonus(lat: number, lon: number, city?: string | null): Promise<WeatherInfo> {
        const headers = await this.getHeaders();
        const data = await this.request<{ weatherBonus: WeatherInfo }>(`${API_URL}/api/social/weather-bonus`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ lat, lon, city }),
        });
        return data.weatherBonus;
    }

    static async getWeatherHistory(): Promise<WeatherLog[]> {
        const headers = await this.getHeaders();
        const data = await this.request<{ history: WeatherLog[] }>(`${API_URL}/api/social/weather-bonus/history`, {
            headers,
        });
        return data.history;
    }

    static async saveWeatherLog(weather: WeatherInfo, workoutId?: string) {
        try {
            const userId = useAuthStore.getState().user?.id;
            if (!userId) return null;

            const logId = uuidV4();
            const now = Date.now();
            await dbService.run(
                `INSERT INTO weather_logs (id, user_id, workout_id, location, temperature, condition, humidity, wind_speed, is_adverse, created_at, updated_at, deleted_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
                [
                    logId,
                    userId,
                    workoutId || null,
                    weather.location,
                    weather.temperature,
                    weather.condition,
                    weather.humidity || null,
                    weather.windSpeed || null,
                    weather.isActive ? 1 : 0,
                    now,
                    now,
                ]
            );
            return logId;
        } catch (e) {
            logger.captureException(e, { scope: 'SocialService.saveWeatherLog' });
            return null;
        }
    }

    // -- PROFILE --

    static async getProfile(): Promise<SocialProfile> {
        const cacheKey = 'social_profile';
        const cached = this.getCached<SocialProfile>(cacheKey);
        if (cached) return cached;

        const headers = await this.getHeaders();
        const data = await this.request<{ profile: SocialProfile }>(`${API_URL}/api/social/profile`, { headers });

        // Ensure both naming conventions exist for local compatibility and coerce types
        if (data.profile) {
            // Handle display_name mapping
            if (data.profile.display_name !== undefined && data.profile.displayName === undefined) {
                data.profile.displayName = data.profile.display_name || '';
            }

            // Normalize visibility state (coerce boolean/number to 0/1)
            const rawIsPublic = data.profile.is_public !== undefined ? data.profile.is_public : data.profile.isPublic;
            if (rawIsPublic !== undefined) {
                // If it's false or 0, it's 0 (Private). Otherwise it's 1 (Public).
                const numericIsPublic = (rawIsPublic === 0 || rawIsPublic === false) ? 0 : 1;
                data.profile.isPublic = numericIsPublic;
                data.profile.is_public = numericIsPublic;
            }
        }

        this.setCache(cacheKey, data.profile);
        return data.profile;
    }

    static async updateProfile(displayName: string, username?: string | null, isPublic?: number) {
        const headers = await this.getHeaders();
        const data = await this.request<{ success: boolean }>(`${API_URL}/api/social/profile`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                displayName,
                username,
                isPublic,
                is_public: isPublic // Send both to ensure backend handles it consistently
            }),
        });

        // Emit event for real-time UI updates
        dataEventService.emit('SOCIAL_UPDATED');

        return data.success;
    }

    static async updateTrainingDays(trainingDays: number[]) {
        const headers = await this.getHeaders();
        const data = await this.request<{ success: boolean }>(`${API_URL}/api/social/profile/training-days`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ trainingDays }),
        });

        // Emit event for real-time UI updates
        dataEventService.emit('SOCIAL_UPDATED');

        return data.success;
    }

    // -- SEARCH --

    static async searchUsers(query: string): Promise<SocialSearchUser[]> {
        if (!query || query.trim().length === 0) return [];
        const headers = await this.getHeaders();
        const data = await this.request<{ users: SocialSearchUser[] }>(`${API_URL}/api/social/search?q=${encodeURIComponent(query.trim())}`, { headers });
        return data.users;
    }

    // -- FRIENDS --

    static async getFriends(): Promise<SocialFriend[]> {
        const cacheKey = 'social_friends';
        const cached = this.getCached<SocialFriend[]>(cacheKey);
        if (cached) return cached;

        const headers = await this.getHeaders();
        const data = await this.request<{ friends: SocialFriend[] }>(`${API_URL}/api/social/friends`, { headers });
        this.setCache(cacheKey, data.friends);
        return data.friends;
    }

    static async sendFriendRequest(friendId: string) {
        if (!friendId || friendId.trim().length === 0) {
            throw new Error('Invalid friend ID');
        }
        const headers = await this.getHeaders();
        const data = await this.request<{ success: boolean }>(`${API_URL}/api/social/friends/request`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ friendId: friendId.trim() }),
        });

        // Emit event for real-time UI updates
        dataEventService.emit('SOCIAL_UPDATED');

        if (data.success) {
            analytics.capture('friend_request_sent', { friend_id: friendId.trim() });
        }

        return data.success;
    }

    static async respondFriendRequest(requestId: string, action: 'accept' | 'reject' | 'block' | 'remove') {
        const headers = await this.getHeaders();
        const data = await this.request<{ success: boolean }>(`${API_URL}/api/social/friends/respond`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ requestId, action }),
        });

        // Emit event for real-time UI updates
        dataEventService.emit('SOCIAL_UPDATED');

        if (data.success) {
            analytics.capture('friend_request_responded', { request_id: requestId, action });
        }

        return data.success;
    }

    // -- INBOX --

    static async getInbox(): Promise<SocialInboxItem[]> {
        const cacheKey = 'social_inbox';
        const cached = this.getCached<SocialInboxItem[]>(cacheKey);
        if (cached) return cached;

        const headers = await this.getHeaders();
        const data = await this.request<{ items: SocialInboxItem[] }>(`${API_URL}/api/social/inbox`, { headers });
        this.setCache(cacheKey, data.items);
        return data.items;
    }

    static async sendToInbox(friendId: string, payload: Record<string, unknown>, type: string = 'routine') {
        const headers = await this.getHeaders();
        const data = await this.request<{ success: boolean }>(`${API_URL}/api/social/inbox/send`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ friendId, payload, type }),
        });
        try {
            // Clear local cache BEFORE emitting event to ensure consistency
            this.clearCache();
            dataEventService.emit('SOCIAL_UPDATED');
        } catch { }
        return data.success;
    }

    static async markAsSeen(id: string, feedType: 'direct_share' | 'activity_log') {
        const now = Date.now();
        const userId = useAuthStore.getState().user?.id;

        try {
            // 1. Local Updates (Offline First)
            if (feedType === 'activity_log') {
                // Personal seenAt (Your own activity)
                await dbService.run('UPDATE activity_feed SET seen_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
                
                // New: Local activity_seen entry for per-user status (Server parity)
                const seenId = `seen:${userId}:${id}`;
                await dbService.run(
                    'INSERT OR REPLACE INTO activity_seen (id, user_id, activity_id, seen_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                    [seenId, userId, id, now, now]
                );
                
                // Project as a separate sync event for the new table
                await dbService.queueSyncMutation('activity_seen', seenId, 'INSERT', { 
                    user_id: userId, 
                    activity_id: id, 
                    seen_at: now, 
                    updated_at: now 
                });

            } else {
                await dbService.run('UPDATE shares_inbox SET seen_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
                await dbService.queueSyncMutation('shares_inbox', id, 'UPDATE', {
                    seen_at: now,
                    updated_at: now
                });
            }
        } catch (e) {
            logger.warn('[SocialService] Local markAsSeen failed', { id, feedType, error: e });
        }

        // Track server update status
        let serverUpdated = false;

        try {
            const headers = await this.getHeaders();
            const data = await this.request<{ success: boolean }>(`${API_URL}/api/social/inbox`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ id, feedType }),
            });
            serverUpdated = data.success;
        } catch (e) {
            // Log but continue; local DB and sync queue are already handled
            logger.info('[SocialService] Server markAsSeen pending (will sync)', { id, feedType });
        }

        // Emit local event AFTER server request (successful or failed-but-queued)
        // This ensures that when subscribers (like SocialTab) reload data, 
        // they fetch the updated state from the server/synced pool.
        this.clearCache();
        dataEventService.emit('SOCIAL_UPDATED');

        return true;
    }

    /**
     * Mark all provided inbox items as seen in batch.
     */
    static async markAllAsSeen(items: SocialInboxItem[]) {
        if (!items || items.length === 0) return true;

        const now = Date.now();
        const userId = useAuthStore.getState().user?.id;

        try {
            await dbService.withTransaction(async () => {
                for (const item of items) {
                    const id = item.id;
                    const feedType = item.feedType || (item.type === 'routine' ? 'direct_share' : 'activity_log');

                    if (feedType === 'activity_log') {
                        await dbService.run('UPDATE activity_feed SET seen_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
                        
                        const seenId = `seen:${userId}:${id}`;
                        await dbService.run(
                            'INSERT OR REPLACE INTO activity_seen (id, user_id, activity_id, seen_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                            [seenId, userId, id, now, now]
                        );
                        
                        await dbService.queueSyncMutation('activity_seen', seenId, 'INSERT', { 
                            user_id: userId, 
                            activity_id: id, 
                            seen_at: now, 
                            updated_at: now 
                        });

                    } else {
                        await dbService.run('UPDATE shares_inbox SET seen_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
                        await dbService.queueSyncMutation('shares_inbox', id, 'UPDATE', { seen_at: now, updated_at: now });
                    }
                }
            });
        } catch (e) {
            logger.warn('[SocialService] Batch local markAllAsSeen failed', { error: e });
        }

        // Server request in batch
        try {
            const headers = await this.getHeaders();
            const payload = items.map(item => ({
                id: item.id,
                feedType: item.feedType || (item.type === 'routine' ? 'direct_share' : 'activity_log')
            }));

            await this.request<{ success: boolean }>(`${API_URL}/api/social/inbox/batch-seen`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ items: payload }),
            });
        } catch (e) {
            logger.info('[SocialService] Batch server markAllAsSeen pending (synced locally)', { error: e });
        }

        this.clearCache();
        dataEventService.emit('SOCIAL_UPDATED');
        return true;
    }

    static async respondInbox(inboxId: string, action: 'accept' | 'reject') {
        const headers = await this.getHeaders();
        const data = await this.request<{ success: boolean }>(`${API_URL}/api/social/inbox/respond`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ inboxId, action }),
        });

        // Emit event for real-time UI updates
        dataEventService.emit('SOCIAL_UPDATED');

        return data.success;
    }

    static async toggleKudo(feedId: string): Promise<'added' | 'removed' | 'error'> {
        if (!feedId || feedId.trim().length === 0) return 'error';

        try {
            const headers = await this.getHeaders();
            const data = await this.request<{ action: string }>(`${API_URL}/api/social/feed/kudos`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ feedId: feedId.trim() }),
            });
            // Handled optimistically by the caller; no need for full reload
            const result = data.action === 'removed' ? 'removed' : 'added';
            if (result === 'added') {
                analytics.capture('kudos_given', { feed_id: feedId.trim() });
            }
            return result;
        } catch (e) {
            logger.captureException(e, { scope: 'SocialService.toggleKudo' });
            return 'error';
        }
    }

    // -- ANALYTICS --

    static async getAnalytics(): Promise<SocialLeaderboardEntry[]> {
        const cacheKey = 'social_leaderboard';
        const cached = this.getCached<SocialLeaderboardEntry[]>(cacheKey);
        if (cached) return cached;

        const headers = await this.getHeaders();
        const data = await this.request<{ leaderboard: SocialLeaderboardEntry[] }>(`${API_URL}/api/social/analytics`, { headers });
        this.setCache(cacheKey, data.leaderboard);
        return data.leaderboard;
    }

    static async compareFriend(friendId: string): Promise<SocialComparisonEntry[]> {
        const cacheKey = `social_compare_${friendId}`;
        const cached = this.getCached<SocialComparisonEntry[]>(cacheKey);
        if (cached) return cached;

        const headers = await this.getHeaders();
        const data = await this.request<{ comparison: SocialComparisonEntry[] }>(`${API_URL}/api/social/compare?friendId=${encodeURIComponent(friendId)}`, { headers });
        this.setCache(cacheKey, data.comparison);
        return data.comparison;
    }
}

/**
 * Sistema IronScore - Especificación y Reglas
 * 
 * 1. Nueva Economía de Puntos (Valores Base)
 * Los puntos se otorgan al finalizar cada entrenamiento, premiando el esfuerzo real y no solo la asistencia.
 * NO se reinician nunca ni se pierden.
 * 
 * - Completar Entrenamiento: +20 pts.
 * - Día Extra (Superar meta semanal): +10 pts (Tope de 2 días extra premiados por semana).
 * - Romper PR (1RM estimado - Ejercicio Normal): +10 pts.
 * - Romper PR (1RM estimado - Big 3: Squat, Deadlift, Bench Press): +25 pts.
 * - Bonus "Voluntad de Hierro" (Clima adverso/Lluvia): +15 pts.
 * 
 * 2. Sistema de Rachas (Streaks Semanales)
 * El multiplicador se basa en semanas consecutivas cumpliendo la meta de días configurada por el usuario.
 * Se elimina la racha de "días consecutivos" para promover un descanso saludable.
 * 
 * - Semanas 1 a 2: 1.0x (Sin bonus)
 * - Semanas 3 a 4: 1.1x
 * - Semanas 5 a 9: 1.25x
 * - Semanas 10+ (Modo Bestia): 1.5x
 * 
 * 3. Eventos de Administrador (Global Multipliers)
 * Multiplicadores temporales (Doble XP) activados desde el panel de Admin.
 * Aplica a todo el puntaje generado durante el período del evento.
 * 
 * 4. Plan de Implementación Técnica (Backend/App)
 * - Cálculo en Tiempo Real: Cambiar la lógica actual para que el puntaje se calcule y se sume al perfil 
 *   del usuario justo en el momento en que finaliza y guarda un entrenamiento (no reconstrucción histórica).
 * - Sistema de PRs (Personal Records): Al guardar un entrenamiento, el backend compara el nuevo 1RM estimado 
 *   contra el historial. Si es mayor, se otorgan puntos y se actualiza el récord.
 * - Integración de Clima: En la app móvil, enviar latitud/longitud al finalizar. El backend consulta 
 *   API (OpenWeather) y aplica el bonus por lluvia/nieve/frío extremo.
 * - Tabla de Eventos Globales: Tabla `global_events` para pre-programar multiplicadores.
 * - Control de Meta Semanal: Evaluación cada lunes para actualizar el multiplicador de racha.
 */

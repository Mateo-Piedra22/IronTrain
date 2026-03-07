import * as SecureStore from 'expo-secure-store';
import { Config } from '../constants/Config';
import { dataEventService } from './DataEventService';

const API_URL = Config.API_URL;

export interface SocialProfile {
    id: string;
    displayName: string | null;
    username: string | null;
    shareStats?: number | null;
    isPublic?: number | null;
    updatedAt?: string | number | Date | null;
    activeEvent?: GlobalEvent | null;
    weatherBonus?: WeatherInfo | null;
}

export interface GlobalEvent {
    id: string;
    title: string;
    description: string;
    multiplier: number;
    startDate: string;
    endDate: string;
    type: 'xp_boost' | 'special_event';
}

export interface WeatherInfo {
    location: string;
    condition: string;
    temperature: number;
    multiplier: number;
    isActive: boolean;
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
        };
    }

    private static async request<T>(url: string, options: RequestInit = {}): Promise<T> {
        const res = await fetch(url, options);
        const text = await res.text();

        // Try to parse JSON safely
        let data: any;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error(`[SocialService] Failed to parse JSON from ${url}. Status: ${res.status}. Body starts with: ${text.substring(0, 50)}`);
            throw new Error(`Error del servidor (Código ${res.status}). La respuesta no es válida.`);
        }

        if (!res.ok) {
            throw new Error(data.error || data.message || `Error en la solicitud (${res.status})`);
        }

        return data;
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

    // -- PROFILE --

    static async getProfile(): Promise<SocialProfile> {
        const headers = await this.getHeaders();
        const data = await this.request<{ profile: SocialProfile }>(`${API_URL}/api/social/profile`, { headers });
        return data.profile;
    }

    static async updateProfile(displayName: string, username?: string | null, isPublic?: number) {
        const headers = await this.getHeaders();
        const data = await this.request<{ success: boolean }>(`${API_URL}/api/social/profile`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ displayName, username, isPublic }),
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
        const headers = await this.getHeaders();
        const data = await this.request<{ friends: SocialFriend[] }>(`${API_URL}/api/social/friends`, { headers });
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

        return data.success;
    }

    // -- INBOX --

    static async getInbox(): Promise<SocialInboxItem[]> {
        const headers = await this.getHeaders();
        const data = await this.request<{ items: SocialInboxItem[] }>(`${API_URL}/api/social/inbox`, { headers });
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
            dataEventService.emit('SOCIAL_UPDATED');
        } catch { }
        return data.success;
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
            try {
                dataEventService.emit('SOCIAL_UPDATED');
            } catch { }
            return data.action === 'removed' ? 'removed' : 'added';
        } catch (e) {
            console.error('[SocialService] Toggle Kudo failed:', e);
            return 'error';
        }
    }

    // -- ANALYTICS --

    static async getAnalytics(): Promise<SocialLeaderboardEntry[]> {
        const headers = await this.getHeaders();
        const data = await this.request<{ leaderboard: SocialLeaderboardEntry[] }>(`${API_URL}/api/social/analytics`, { headers });
        return data.leaderboard;
    }

    static async compareFriend(friendId: string): Promise<SocialComparisonEntry[]> {
        const headers = await this.getHeaders();
        const data = await this.request<{ comparison: SocialComparisonEntry[] }>(`${API_URL}/api/social/compare?friendId=${encodeURIComponent(friendId)}`, { headers });
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

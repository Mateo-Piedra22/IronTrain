import * as SecureStore from 'expo-secure-store';
import { Config } from '../constants/Config';

const API_URL = Config.API_URL;

export interface SocialProfile {
    id: string;
    displayName: string | null;
    username: string | null;
    shareStats?: number | null;
    isPublic?: number | null;
    updatedAt?: string | number | Date | null;
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

    // -- PROFILE --

    static async getProfile(): Promise<SocialProfile> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/social/profile`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch profile');
        return data.profile;
    }

    static async updateProfile(displayName: string, username?: string | null, isPublic?: number) {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/social/profile`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ displayName, username, isPublic }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update profile');

        // Emit event for real-time UI updates
        const { dataEventService } = await import('./DataEventService');
        dataEventService.emit('SOCIAL_UPDATED');

        return data.success;
    }

    // -- SEARCH --

    static async searchUsers(query: string): Promise<SocialSearchUser[]> {
        if (!query || query.trim().length === 0) return [];
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/social/search?q=${encodeURIComponent(query.trim())}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Search failed');
        return data.users;
    }

    // -- FRIENDS --

    static async getFriends(): Promise<SocialFriend[]> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/social/friends`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch friends');
        return data.friends;
    }

    static async sendFriendRequest(friendId: string) {
        if (!friendId || friendId.trim().length === 0) {
            throw new Error('Invalid friend ID');
        }
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/social/friends/request`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ friendId: friendId.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send request');

        // Emit event for real-time UI updates
        const { dataEventService } = await import('./DataEventService');
        dataEventService.emit('SOCIAL_UPDATED');

        return data.success;
    }

    static async respondFriendRequest(requestId: string, action: 'accept' | 'reject' | 'block' | 'remove') {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/social/friends/respond`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ requestId, action }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to respond');

        // Emit event for real-time UI updates
        const { dataEventService } = await import('./DataEventService');
        dataEventService.emit('SOCIAL_UPDATED');

        return data.success;
    }

    // -- INBOX --

    static async getInbox(): Promise<SocialInboxItem[]> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/social/inbox`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch inbox');
        return data.items;
    }

    static async sendToInbox(friendId: string, payload: Record<string, unknown>, type: string = 'routine') {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/social/inbox/send`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ friendId, payload, type }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send');
        try {
            const { dataEventService } = await import('./DataEventService');
            dataEventService.emit('SOCIAL_UPDATED');
        } catch { }
        return data.success;
    }

    static async respondInbox(inboxId: string, action: 'accept' | 'reject') {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/social/inbox/respond`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ inboxId, action }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to respond');

        // Emit event for real-time UI updates
        const { dataEventService } = await import('./DataEventService');
        dataEventService.emit('SOCIAL_UPDATED');

        return data.success;
    }

    static async toggleKudo(feedId: string): Promise<'added' | 'removed' | 'error'> {
        if (!feedId || feedId.trim().length === 0) return 'error';

        try {
            const headers = await this.getHeaders();
            const res = await fetch(`${API_URL}/api/social/feed/kudos`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ feedId: feedId.trim() }),
            });
            const data = await res.json();
            if (!res.ok) return 'error';
            try {
                const { dataEventService } = await import('./DataEventService');
                dataEventService.emit('SOCIAL_UPDATED');
            } catch { }
            return data.action === 'removed' ? 'removed' : 'added';
        } catch (e) {
            return 'error';
        }
    }

    // -- ANALYTICS --

    static async getAnalytics(): Promise<SocialLeaderboardEntry[]> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/social/analytics`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch analytics');
        return data.leaderboard;
    }

    static async compareFriend(friendId: string): Promise<SocialComparisonEntry[]> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/social/compare?friendId=${encodeURIComponent(friendId)}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to compare');
        return data.comparison;
    }
}

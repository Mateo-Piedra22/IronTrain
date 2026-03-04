import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://irontrain.motiona.xyz';

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
    senderId: string;
    senderName: string;
    type: 'routine';
    payload: unknown;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string | number | Date;
}

export interface SocialLeaderboardEntry {
    id: string;
    displayName: string;
    score: number;
    workouts: number;
    routines: number;
    shares: number;
}

export interface SocialSearchUser {
    id: string;
    displayName: string | null;
    username: string | null;
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

    static async updateProfile(displayName: string, username?: string, isPublic?: number) {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/social/profile`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ displayName, username, isPublic }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update profile');
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
        return data.success;
    }

    // -- ANALYTICS --

    static async getAnalytics(): Promise<SocialLeaderboardEntry[]> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/social/analytics`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch analytics');
        return data.leaderboard;
    }
}

import { SocialFriend, SocialInboxItem } from '@/src/services/SocialService';

export type ActivityKind = 'pr' | 'workout' | 'routine' | 'other';

export type SocialStory = {
    userId: string;
    name: string;
    username: string | null;
    trainedToday: boolean;
    lastActivityAt: string | null;
    activityKind: ActivityKind;
};

export type ActivityVisualSummary = {
    headline: string;
    subline: string;
    highlightLabel: string;
    highlightValue: string;
    badge: string;
    activityKind: ActivityKind;
};

const safeDate = (value: unknown): Date | null => {
    if (!value) return null;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isToday = (value: unknown): boolean => {
    const date = safeDate(value);
    if (!date) return false;
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
};

const getActivityKind = (item: SocialInboxItem): ActivityKind => {
    if (item.actionType === 'pr_broken') return 'pr';
    if (item.actionType === 'workout_completed') return 'workout';
    if (item.actionType === 'routine_shared') return 'routine';
    return 'other';
};

const parseMeta = (metadata: unknown): Record<string, unknown> => {
    if (!metadata) return {};
    if (typeof metadata === 'object') return metadata as Record<string, unknown>;
    if (typeof metadata === 'string') {
        try {
            const parsed = JSON.parse(metadata);
            return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
        } catch {
            return {};
        }
    }
    return {};
};

const asNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

export const buildActivityVisualSummary = (item: SocialInboxItem): ActivityVisualSummary => {
    const meta = parseMeta(item.metadata);
    const kind = getActivityKind(item);

    if (kind === 'pr') {
        const exerciseName = typeof meta.exerciseName === 'string' ? meta.exerciseName : 'Ejercicio';
        const weight = asNumber(meta.weight);
        const reps = asNumber(meta.reps);
        const oneRm = asNumber(meta.oneRm);
        const unit = typeof meta.unit === 'string' ? meta.unit : 'kg';

        if (weight && reps) {
            return {
                headline: 'Nuevo PR',
                subline: exerciseName,
                highlightLabel: 'Carga',
                highlightValue: `${weight}${unit} x ${reps}`,
                badge: 'PR',
                activityKind: kind,
            };
        }

        if (oneRm) {
            return {
                headline: 'Nuevo PR',
                subline: exerciseName,
                highlightLabel: '1RM',
                highlightValue: `${Math.round(oneRm)}${unit}`,
                badge: 'PR',
                activityKind: kind,
            };
        }

        return {
            headline: 'Récord Personal',
            subline: exerciseName,
            highlightLabel: 'Estado',
            highlightValue: 'Superado',
            badge: 'PR',
            activityKind: kind,
        };
    }

    if (kind === 'workout') {
        const volume = asNumber(meta.totalVolume ?? meta.volume);
        const exercises = asNumber(meta.exercisesCount ?? meta.totalExercises);

        return {
            headline: 'Entrenamiento completo',
            subline: 'Sesión finalizada',
            highlightLabel: volume ? 'Volumen' : 'Ejercicios',
            highlightValue: volume ? `${Math.round(volume)} kg` : `${exercises ?? 0}`,
            badge: 'WORKOUT',
            activityKind: kind,
        };
    }

    if (kind === 'routine') {
        const routineName = typeof meta.routineName === 'string' ? meta.routineName : 'Rutina compartida';

        return {
            headline: 'Rutina compartida',
            subline: routineName,
            highlightLabel: 'Acción',
            highlightValue: 'Disponible',
            badge: 'ROUTINE',
            activityKind: kind,
        };
    }

    return {
        headline: 'Actividad reciente',
        subline: 'Actualización social',
        highlightLabel: 'Estado',
        highlightValue: 'Nueva',
        badge: 'SOCIAL',
        activityKind: 'other',
    };
};

export const selectActivityFeed = (inbox: SocialInboxItem[], profileId?: string | null): SocialInboxItem[] => {
    const activityFeed: SocialInboxItem[] = [];

    for (const item of inbox) {
        if (item.feedType !== 'activity_log') continue;
        activityFeed.push({
            ...item,
            senderName: item.senderId === profileId ? 'Tú' : item.senderName,
        });
    }

    activityFeed.sort((a, b) => {
        const aDate = safeDate(a.createdAt)?.getTime() ?? 0;
        const bDate = safeDate(b.createdAt)?.getTime() ?? 0;
        return bDate - aDate;
    });

    return activityFeed;
};

export const selectNotificationShares = (inbox: SocialInboxItem[]): SocialInboxItem[] => {
    return inbox
        .filter((item) => item.feedType === 'direct_share')
        .sort((a, b) => {
            const aDate = safeDate(a.createdAt)?.getTime() ?? 0;
            const bDate = safeDate(b.createdAt)?.getTime() ?? 0;
            return bDate - aDate;
        });
};

export const selectIncomingFriendRequests = (friends: SocialFriend[]): SocialFriend[] => {
    return friends
        .filter((friend) => friend.status === 'pending' && !friend.isSender)
        .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
};

export const buildStories = (activityFeed: SocialInboxItem[]): SocialStory[] => {
    const byUser = new Map<string, SocialInboxItem>();

    activityFeed.forEach((item) => {
        if (!item.senderId) return;
        const existing = byUser.get(item.senderId);
        const existingAt = safeDate(existing?.createdAt)?.getTime() ?? 0;
        const currentAt = safeDate(item.createdAt)?.getTime() ?? 0;
        if (!existing || currentAt > existingAt) {
            byUser.set(item.senderId, item);
        }
    });

    return Array.from(byUser.values())
        .map((item) => ({
            userId: item.senderId,
            name: item.senderName || 'Usuario',
            username: item.senderUsername ?? null,
            trainedToday: isToday(item.createdAt),
            lastActivityAt: item.createdAt ? String(item.createdAt) : null,
            activityKind: getActivityKind(item),
        }))
        .sort((a, b) => {
            if (a.trainedToday !== b.trainedToday) return a.trainedToday ? -1 : 1;
            const aDate = safeDate(a.lastActivityAt)?.getTime() ?? 0;
            const bDate = safeDate(b.lastActivityAt)?.getTime() ?? 0;
            return bDate - aDate;
        });
};

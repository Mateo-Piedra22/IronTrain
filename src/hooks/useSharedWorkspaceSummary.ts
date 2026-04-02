import { useCallback, useMemo, useState } from 'react';
import { dbService } from '../services/DatabaseService';
import { SharedRoutineItem, SocialService } from '../services/SocialService';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';

interface UseSharedWorkspaceSummaryOptions {
    includePendingReviews?: boolean;
}

interface SharedWorkspaceSummary {
    loading: boolean;
    workspaces: SharedRoutineItem[];
    workspaceCount: number;
    pendingReviewsCount: number;
    linkedRoutineIds: string[];
    reload: () => Promise<void>;
}

export function useSharedWorkspaceSummary(options: UseSharedWorkspaceSummaryOptions = {}): SharedWorkspaceSummary {
    const { includePendingReviews = false } = options;
    const [loading, setLoading] = useState(false);
    const [sharedSpaces, setSharedSpaces] = useState<SharedRoutineItem[]>([]);
    const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
    const [localLinkedRoutineIds, setLocalLinkedRoutineIds] = useState<string[]>([]);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const items = await SocialService.listSharedRoutines();
            setSharedSpaces(items);

            try {
                const userId = useAuthStore.getState().user?.id || null;
                const links = await dbService.getAll<{ local_routine_id: string }>(
                    'SELECT local_routine_id FROM shared_routine_links WHERE ((user_id = ?) OR (user_id IS NULL AND ? IS NULL))',
                    [userId, userId]
                );
                setLocalLinkedRoutineIds(
                    Array.from(new Set(links.map((row) => row.local_routine_id).filter((id): id is string => !!id)))
                );
            } catch {
                setLocalLinkedRoutineIds([]);
            }

            if (includePendingReviews) {
                const fromItems = items.reduce((acc, workspace) => acc + (workspace.pendingReviewsCount ?? 0), 0);
                setPendingReviewsCount(fromItems);
            } else {
                setPendingReviewsCount(0);
            }
        } catch (error) {
            logger.captureException(error, { scope: 'useSharedWorkspaceSummary.reload' });
            setSharedSpaces([]);
            setPendingReviewsCount(0);
            setLocalLinkedRoutineIds([]);
        } finally {
            setLoading(false);
        }
    }, [includePendingReviews]);

    const linkedRoutineIds = useMemo(
        () => Array.from(new Set([
            ...sharedSpaces.map((sharedSpace) => sharedSpace.sourceRoutineId).filter((id): id is string => !!id),
            ...localLinkedRoutineIds,
        ])),
        [sharedSpaces, localLinkedRoutineIds]
    );

    return {
        loading,
        workspaces: sharedSpaces,
        workspaceCount: sharedSpaces.length,
        pendingReviewsCount,
        linkedRoutineIds,
        reload,
    };
}
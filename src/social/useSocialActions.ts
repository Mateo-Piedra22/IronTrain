import { routineService } from '@/src/services/RoutineService';
import { SocialFriend, SocialInboxItem, SocialSearchUser, SocialService } from '@/src/services/SocialService';
import { feedbackError, feedbackSelection, feedbackSoftImpact, feedbackSuccess, feedbackWarning } from '@/src/social/feedback';
import { confirm } from '@/src/store/confirmStore';
import * as analytics from '@/src/utils/analytics';
import { logger } from '@/src/utils/logger';
import * as Clipboard from 'expo-clipboard';
import { Dispatch, SetStateAction, useCallback } from 'react';

type ToastPayload = {
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message?: string;
};

type SetState<T> = Dispatch<SetStateAction<T>>;

interface UseSocialActionsInput {
    addToast: (payload: ToastPayload) => void;
    fetchInitialData: (force?: boolean, silent?: boolean) => Promise<void>;
    setSearchResults: SetState<SocialSearchUser[]>;
    selectedFriend: SocialFriend | null;
    setSelectedFriend: SetState<SocialFriend | null>;
    setFriendActionLoading: SetState<boolean>;
    setInbox: (inbox: SocialInboxItem[] | ((prev: SocialInboxItem[]) => SocialInboxItem[])) => void;
    notificationShares: SocialInboxItem[];
    filteredCommunityFeedItems: SocialInboxItem[];
    hiddenFeedIds: string[];
    setHiddenFeedIds: SetState<string[]>;
    profileId?: string;
}

export function useSocialActions({
    addToast,
    fetchInitialData,
    setSearchResults,
    selectedFriend,
    setSelectedFriend,
    setFriendActionLoading,
    setInbox,
    notificationShares,
    filteredCommunityFeedItems,
    hiddenFeedIds,
    setHiddenFeedIds,
    profileId,
}: UseSocialActionsInput) {
    const handleSendFriendRequest = useCallback(async (friendId: string) => {
        try {
            feedbackSelection();
            await SocialService.sendFriendRequest(friendId);
            feedbackSuccess();
            addToast({ type: 'success', title: 'Solicitud enviada' });
            setSearchResults(results => results.filter(u => u.id !== friendId));
        } catch (err: unknown) {
            feedbackError();
            const message = err instanceof Error ? err.message : 'No se pudo enviar la solicitud.';
            addToast({ type: 'error', title: 'Error', message });
        }
    }, [addToast, setSearchResults]);

    const handleAcceptFriend = useCallback(async (requestId: string) => {
        try {
            feedbackSelection();
            await SocialService.respondFriendRequest(requestId, 'accept');
            await fetchInitialData(true);
            feedbackSuccess();
            addToast({ type: 'success', title: 'Amigo agregado' });
        } catch {
            feedbackError();
            addToast({ type: 'error', title: 'Error al aceptar' });
        }
    }, [fetchInitialData, addToast]);

    const handleRejectFriend = useCallback(async (requestId: string) => {
        try {
            feedbackSelection();
            await SocialService.respondFriendRequest(requestId, 'reject');
            await fetchInitialData(true);
        } catch {
            feedbackError();
            addToast({ type: 'error', title: 'Error al rechazar' });
        }
    }, [fetchInitialData, addToast]);

    const handleFriendModalAction = useCallback(async (action: 'accept' | 'reject' | 'remove' | 'block') => {
        if (!selectedFriend) return;

        const run = async () => {
            setFriendActionLoading(true);
            try {
                feedbackSoftImpact();
                await SocialService.respondFriendRequest(selectedFriend.id, action);
                setSelectedFriend(null);
                await fetchInitialData(true, true);
                feedbackSuccess();
                if (action === 'accept') addToast({ type: 'success', title: 'Amigo agregado' });
                if (action === 'remove') addToast({ type: 'success', title: 'Amigo eliminado' });
                if (action === 'block') addToast({ type: 'success', title: 'Usuario bloqueado' });
            } catch (err: unknown) {
                feedbackError();
                const message = err instanceof Error ? err.message : 'No se pudo completar la acción.';
                addToast({ type: 'error', title: 'Error', message });
            } finally {
                setFriendActionLoading(false);
            }
        };

        if (action === 'remove') {
            confirm.destructive(
                'Eliminar amigo',
                `¿Estás seguro de que querés eliminar a ${selectedFriend.displayName}?`,
                run
            );
            return;
        }

        if (action === 'block') {
            confirm.destructive(
                'Bloquear usuario',
                `¿Querés bloquear a ${selectedFriend.displayName}?`,
                run
            );
            return;
        }

        await run();
    }, [selectedFriend, setFriendActionLoading, setSelectedFriend, fetchInitialData, addToast]);

    const handleInboxResponse = useCallback(async (inboxId: string, action: 'accept' | 'reject', payload?: unknown) => {
        try {
            feedbackSelection();
            if (action === 'accept' && payload) {
                await routineService.syncSharedRoutinePayload(payload as any);
                addToast({ type: 'success', title: 'Rutina importada', message: 'Ya podés verla en tu biblioteca.' });
            }
            if (action === 'accept') {
                analytics.capture('routine_imported', { source: 'inbox', inbox_id: inboxId });
            }
            await SocialService.respondInbox(inboxId, action);
            await fetchInitialData(true, true);
            if (action === 'accept') feedbackSuccess();
        } catch {
            feedbackError();
            addToast({ type: 'error', title: 'Error en la acción' });
        }
    }, [addToast, fetchInitialData]);

    const handleToggleKudo = useCallback(async (feedId: string) => {
        try {
            const result = await SocialService.toggleKudo(feedId);
            if (result === 'error') return;
            feedbackSelection();

            setInbox(current => current.map(item => {
                if (item.id === feedId) {
                    const hasKudoed = result === 'added';
                    return {
                        ...item,
                        hasKudoed,
                        kudosCount: Math.max(0, (item.kudosCount || 0) + (hasKudoed ? 1 : -1)),
                    };
                }
                return item;
            }));
        } catch (err) {
            feedbackError();
            logger.captureException(err, { scope: 'SocialTab.toggleKudo' });
            addToast({ type: 'error', title: 'Kudos', message: 'No se pudo actualizar el kudo.' });
        }
    }, [setInbox, addToast]);

    const handleMarkAsSeen = useCallback(async (id: string, feedType: 'direct_share' | 'activity_log') => {
        feedbackSelection();
        setInbox(current => current.map(item => item.id === id ? { ...item, seenAt: new Date().toISOString() } : item));
        try {
            await SocialService.markAsSeen(id, feedType);
        } catch (err) {
            feedbackWarning();
            setInbox(current => current.map(item => item.id === id ? { ...item, seenAt: null } : item));
            logger.captureException(err, { scope: 'SocialTab.markAsSeen' });
            addToast({ type: 'error', title: 'Buzón', message: 'No se pudo marcar como visto.' });
        }
    }, [setInbox, addToast]);

    const handleMarkAllAsSeen = useCallback(async () => {
        const unseen = notificationShares.filter(i => !i.seenAt);
        if (unseen.length === 0) return;

        confirm.ask(
            '¿Archivar todo?',
            `Se marcarán como leídas las ${unseen.length} notificaciones pendientes.`,
            async () => {
                const now = new Date().toISOString();
                const unseenIds = new Set(unseen.map(item => item.id));
                setInbox(current => current.map(item => unseenIds.has(item.id) ? ({ ...item, seenAt: item.seenAt || now }) : item));
                feedbackSuccess();
                addToast({ type: 'success', title: 'Buzón actualizado', message: 'Notificaciones archivadas.' });

                try {
                    await SocialService.markAllAsSeen(unseen);
                } catch (err) {
                    feedbackWarning();
                    logger.captureException(err, { scope: 'SocialTab.markAllAsSeen' });
                    addToast({ type: 'error', title: 'Error servidor', message: 'Algunas notificaciones podrían reaparecer.' });
                }
            },
            'Archivar todo'
        );
    }, [notificationShares, setInbox, addToast]);

    const handleMarkVisibleFeedAsSeen = useCallback(async () => {
        const unseenVisible = filteredCommunityFeedItems.filter((item) => !item.seenAt);
        if (unseenVisible.length === 0) {
            feedbackSelection();
            addToast({ type: 'info', title: 'Feed limpio', message: 'No hay publicaciones nuevas para marcar.' });
            return;
        }

        const now = new Date().toISOString();
        const targetIds = new Set(unseenVisible.map((item) => item.id));
        setInbox((current) => current.map((item) => targetIds.has(item.id) ? { ...item, seenAt: item.seenAt || now } : item));

        const results = await Promise.allSettled(
            unseenVisible.map((item) => SocialService.markAsSeen(item.id, 'activity_log'))
        );

        const rejected = results.filter((result) => result.status === 'rejected').length;
        if (rejected > 0) {
            feedbackWarning();
            addToast({ type: 'error', title: 'Feed', message: `No se pudieron actualizar ${rejected} publicaciones.` });
        } else {
            feedbackSuccess();
            addToast({ type: 'success', title: 'Feed actualizado', message: 'Publicaciones marcadas como vistas.' });
        }
    }, [filteredCommunityFeedItems, setInbox, addToast]);

    const handleHideVisibleFeed = useCallback(() => {
        if (filteredCommunityFeedItems.length === 0) {
            feedbackSelection();
            addToast({ type: 'info', title: 'Feed', message: 'No hay publicaciones visibles para ocultar.' });
            return;
        }

        const toHide = new Set(filteredCommunityFeedItems.map((item) => item.id));
        setHiddenFeedIds((prev) => Array.from(new Set([...prev, ...toHide])));
        feedbackSelection();
        addToast({ type: 'success', title: 'Feed filtrado', message: `${toHide.size} publicaciones ocultadas.` });
    }, [filteredCommunityFeedItems, setHiddenFeedIds, addToast]);

    const handleResetFeedHidden = useCallback(() => {
        if (hiddenFeedIds.length === 0) return;
        setHiddenFeedIds([]);
        feedbackSelection();
        addToast({ type: 'success', title: 'Feed restaurado', message: 'Volviste a mostrar las publicaciones ocultas.' });
    }, [hiddenFeedIds.length, setHiddenFeedIds, addToast]);

    const handleCopyProfileId = useCallback(async () => {
        if (!profileId) return;
        try {
            feedbackSelection();
            await Clipboard.setStringAsync(profileId);
            feedbackSuccess();
            addToast({ type: 'success', title: 'ID copiado' });
        } catch (err) {
            feedbackError();
            logger.captureException(err, { scope: 'SocialTab.copyProfileId' });
            addToast({ type: 'error', title: 'Perfil', message: 'No se pudo copiar el ID.' });
        }
    }, [profileId, addToast]);

    return {
        handleSendFriendRequest,
        handleAcceptFriend,
        handleRejectFriend,
        handleFriendModalAction,
        handleInboxResponse,
        handleToggleKudo,
        handleMarkAsSeen,
        handleMarkAllAsSeen,
        handleMarkVisibleFeedAsSeen,
        handleHideVisibleFeed,
        handleResetFeedHidden,
        handleCopyProfileId,
    };
}

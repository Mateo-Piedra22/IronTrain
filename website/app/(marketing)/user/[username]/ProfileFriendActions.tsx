'use client';

import { useEffect, useMemo, useState } from 'react';

type RelationshipStatus = 'none' | 'pending_outgoing' | 'pending_incoming' | 'accepted' | 'blocked';

type Props = {
    currentUserId: string | null;
    profileUserId: string;
    initialStatus: RelationshipStatus;
    requestId: string | null;
};

export default function ProfileFriendActions({
    currentUserId,
    profileUserId,
    initialStatus,
    requestId,
}: Props) {
    const [status, setStatus] = useState<RelationshipStatus>(initialStatus);
    const [relationshipId, setRelationshipId] = useState<string | null>(requestId);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);

    useEffect(() => {
        if (!message) return;
        const timeout = setTimeout(() => {
            setMessage(null);
            setMessageType(null);
        }, 3000);

        return () => clearTimeout(timeout);
    }, [message]);

    const hidden = useMemo(() => !currentUserId || currentUserId === profileUserId, [currentUserId, profileUserId]);

    if (hidden) return null;

    const statusClass = status === 'accepted'
        ? 'border-emerald-700/80 text-emerald-800 bg-emerald-50'
        : status === 'pending_outgoing'
            ? 'border-amber-700/80 text-amber-800 bg-amber-50'
            : status === 'pending_incoming'
                ? 'border-blue-700/80 text-blue-800 bg-blue-50'
                : status === 'blocked'
                    ? 'border-red-700/80 text-red-800 bg-red-50'
                    : 'border-[#1a1a2e]/40 text-[#1a1a2e]/70 bg-transparent';

    const postJson = async (url: string, body: Record<string, unknown>) => {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify(body),
        });

        const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;

        if (!response.ok) {
            throw new Error(payload?.error || 'Error al procesar acción social');
        }

        return payload;
    };

    const sendRequest = async () => {
        try {
            setBusy(true);
            setMessage(null);
            setMessageType(null);
            await postJson('/api/social/friends/request', { friendId: profileUserId });
            setStatus('pending_outgoing');
            setMessage('Solicitud enviada.');
            setMessageType('success');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'No se pudo enviar la solicitud.');
            setMessageType('error');
        } finally {
            setBusy(false);
        }
    };

    const respondRequest = async (action: 'accept' | 'reject' | 'remove') => {
        if (!relationshipId) {
            setMessage('No se encontró la relación para esta acción.');
            setMessageType('error');
            return;
        }

        try {
            setBusy(true);
            setMessage(null);
            setMessageType(null);
            await postJson('/api/social/friends/respond', { requestId: relationshipId, action });

            if (action === 'accept') {
                setStatus('accepted');
                setMessage('Ahora son amistades.');
                setMessageType('success');
                return;
            }

            setStatus('none');
            if (action === 'reject') setMessage('Solicitud rechazada.');
            if (action === 'remove') setMessage('Amistad eliminada.');
            setMessageType('success');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'No se pudo completar la acción.');
            setMessageType('error');
        } finally {
            setBusy(false);
        }
    };

    const renderByStatus = () => {
        if (status === 'none') {
            return (
                <button
                    type="button"
                    onClick={sendRequest}
                    disabled={busy}
                    className="px-4 py-2 border-2 border-[#1a1a2e] bg-[#1a1a2e] text-[#f5f1e8] text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-40"
                >
                    {busy ? 'ENVIANDO...' : 'AGREGAR_AMISTAD'}
                </button>
            );
        }

        if (status === 'pending_outgoing') {
            return (
                <div className={`px-4 py-2 border-2 text-[10px] font-black uppercase tracking-[0.2em] ${statusClass}`}>
                    SOLICITUD_ENVIADA
                </div>
            );
        }

        if (status === 'pending_incoming') {
            return (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => respondRequest('accept')}
                        disabled={busy}
                        className="px-4 py-2 border-2 border-blue-700/80 bg-blue-700 text-white text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-40"
                    >
                        ACEPTAR
                    </button>
                    <button
                        type="button"
                        onClick={() => respondRequest('reject')}
                        disabled={busy}
                        className="px-4 py-2 border-2 border-[#1a1a2e]/60 text-[#1a1a2e]/80 text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-40"
                    >
                        RECHAZAR
                    </button>
                </div>
            );
        }

        if (status === 'accepted') {
            return (
                <div className="flex items-center gap-2">
                    <div className={`px-4 py-2 border-2 text-[10px] font-black uppercase tracking-[0.2em] ${statusClass}`}>
                        AMISTAD_ACTIVA
                    </div>
                    <button
                        type="button"
                        onClick={() => respondRequest('remove')}
                        disabled={busy}
                        className="px-4 py-2 border-2 border-emerald-700/80 text-emerald-800 text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-40"
                    >
                        ELIMINAR
                    </button>
                </div>
            );
        }

        return (
            <div className={`px-4 py-2 border-2 text-[10px] font-black uppercase tracking-[0.2em] ${statusClass}`}>
                BLOQUEADO
            </div>
        );
    };

    return (
        <div className="mt-6 flex flex-col items-center md:items-start gap-2">
            {renderByStatus()}
            {message && (
                <p className={`text-[10px] font-bold uppercase tracking-[0.15em] transition-opacity duration-300 ${messageType === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
                    {message}
                </p>
            )}
        </div>
    );
}

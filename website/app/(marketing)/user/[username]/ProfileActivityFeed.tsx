'use client';

import { useEffect, useMemo, useState } from 'react';

type ActivityItem = {
    id: string;
    actionType: string;
    metadata: unknown;
    createdAt: Date | string | null;
    kudoCount: number | null;
};

type Props = {
    items: ActivityItem[];
    initialKudoedIds: string[];
    canReact: boolean;
};

const activityLabel = (actionType: string) => {
    if (actionType === 'pr_broken') return 'PR roto';
    if (actionType === 'routine_shared') return 'Rutina compartida';
    return 'Workout completado';
};

export default function ProfileActivityFeed({ items, initialKudoedIds, canReact }: Props) {
    const [kudoedIds, setKudoedIds] = useState<Set<string>>(new Set(initialKudoedIds));
    const [kudoCountById, setKudoCountById] = useState<Record<string, number>>(() => {
        const initial: Record<string, number> = {};
        for (const item of items) {
            initial[item.id] = Number(item.kudoCount || 0);
        }
        return initial;
    });
    const [busyId, setBusyId] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [feedbackType, setFeedbackType] = useState<'success' | 'error' | null>(null);

    useEffect(() => {
        if (!feedback) return;
        const timeout = setTimeout(() => {
            setFeedback(null);
            setFeedbackType(null);
        }, 2500);

        return () => clearTimeout(timeout);
    }, [feedback]);

    const renderedItems = useMemo(() => items, [items]);

    const toggleKudo = async (feedId: string) => {
        try {
            setBusyId(feedId);
            setFeedback(null);
            setFeedbackType(null);

            const response = await fetch('/api/social/feed/kudos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ feedId }),
            });

            const payload = await response.json().catch(() => null) as { action?: 'added' | 'removed'; error?: string } | null;

            if (!response.ok || !payload?.action) {
                throw new Error(payload?.error || 'No se pudo actualizar el kudo.');
            }

            setKudoedIds((prev) => {
                const next = new Set(prev);
                const currentCount = kudoCountById[feedId] ?? 0;

                if (payload.action === 'added') {
                    next.add(feedId);
                    setKudoCountById((old) => ({ ...old, [feedId]: currentCount + 1 }));
                    setFeedback('Kudo enviado.');
                    setFeedbackType('success');
                } else {
                    next.delete(feedId);
                    setKudoCountById((old) => ({ ...old, [feedId]: Math.max(0, currentCount - 1) }));
                    setFeedback('Kudo removido.');
                    setFeedbackType('success');
                }

                return next;
            });
        } catch (err) {
            setFeedback(err instanceof Error ? err.message : 'Error al reaccionar.');
            setFeedbackType('error');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-4">
            {feedback && (
                <p className={`text-[10px] font-bold uppercase tracking-[0.15em] transition-opacity duration-300 ${feedbackType === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
                    {feedback}
                </p>
            )}
            <div className="grid md:grid-cols-2 gap-6">
                {renderedItems.map((entry) => {
                    const metadata = (typeof entry.metadata === 'object' && entry.metadata !== null)
                        ? entry.metadata as Record<string, unknown>
                        : null;
                    const value = metadata?.prValue ?? metadata?.pointsAwarded ?? metadata?.durationMin;
                    const isKudoed = kudoedIds.has(entry.id);
                    const isBusy = busyId === entry.id;

                    return (
                        <article key={entry.id} className="border-2 border-[#1a1a2e] p-5 bg-white">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-[10px] font-black uppercase tracking-[0.15em] opacity-70">{activityLabel(entry.actionType)}</div>
                                <div className="text-[10px] font-bold opacity-40">
                                    {new Date(entry.createdAt || new Date()).toLocaleDateString('es-AR')}
                                </div>
                            </div>

                            <div className="text-xs font-bold uppercase tracking-[0.15em] opacity-60">Kudos: {kudoCountById[entry.id] ?? 0}</div>

                            {value !== undefined && value !== null && (
                                <div className="mt-3 text-3xl font-black tracking-tighter">{String(value)}</div>
                            )}

                            {canReact && (
                                <button
                                    type="button"
                                    onClick={() => toggleKudo(entry.id)}
                                    disabled={isBusy}
                                    className={`mt-4 px-3 py-2 border-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-40 ${isKudoed ? 'bg-[#1a1a2e] text-[#f5f1e8] border-[#1a1a2e]' : 'border-[#1a1a2e] text-[#1a1a2e]'}`}
                                >
                                    {isBusy ? 'PROCESANDO...' : isKudoed ? 'KUDO_DADO' : 'DAR_KUDO'}
                                </button>
                            )}
                        </article>
                    );
                })}
            </div>
        </div>
    );
}

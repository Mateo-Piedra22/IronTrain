'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type ThemeInteractionsPanelProps = {
    themeId: string;
    isLoggedIn: boolean;
    isOwner: boolean;
    loginHref: string;
    initialRating: number | null;
    initialReview: string | null;
    recentOwnFeedback: Array<{
        id: string;
        kind: string;
        message: string;
        status: string;
        updatedAt: Date | string | null;
    }>;
    shareSlug: string;
    currentCommentsPage: number;
    ownFeedbackStatus: 'all' | 'open' | 'resolved' | 'dismissed';
    ownFeedbackPage: number;
    ownFeedbackTotalPages: number;
};

type NoticeTone = 'ok' | 'warn';

const readApiError = async (response: Response): Promise<string> => {
    const fallback = `Error ${response.status}`;
    try {
        const body = await response.json();
        if (typeof body?.error === 'string' && body.error.trim().length > 0) {
            return body.error;
        }
        if (typeof body?.message === 'string' && body.message.trim().length > 0) {
            return body.message;
        }
        return fallback;
    } catch {
        return fallback;
    }
};

export function ThemeInteractionsPanel({
    themeId,
    isLoggedIn,
    isOwner,
    loginHref,
    initialRating,
    initialReview,
    recentOwnFeedback,
    shareSlug,
    currentCommentsPage,
    ownFeedbackStatus,
    ownFeedbackPage,
    ownFeedbackTotalPages,
}: ThemeInteractionsPanelProps) {
    const router = useRouter();

    const [rating, setRating] = useState<number>(initialRating ?? 5);
    const [review, setReview] = useState<string>(initialReview ?? '');

    const [feedbackKind, setFeedbackKind] = useState<'issue' | 'suggestion' | 'praise'>('suggestion');
    const [feedbackMessage, setFeedbackMessage] = useState<string>('');

    const [reportReason, setReportReason] = useState<'nsfw' | 'hate' | 'spam' | 'impersonation' | 'malware' | 'other'>('spam');
    const [reportDetails, setReportDetails] = useState<string>('');

    const [isSendingRating, setIsSendingRating] = useState(false);
    const [isSendingFeedback, setIsSendingFeedback] = useState(false);
    const [isSendingReport, setIsSendingReport] = useState(false);

    const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);

    const canInteract = isLoggedIn && !isOwner;

    const reviewLength = useMemo(() => review.trim().length, [review]);
    const feedbackLength = useMemo(() => feedbackMessage.trim().length, [feedbackMessage]);
    const reportLength = useMemo(() => reportDetails.trim().length, [reportDetails]);

    const getStatusBadgeClasses = (status: string) => {
        if (status === 'resolved') {
            return 'border-emerald-700/60 bg-emerald-700/10 text-emerald-800';
        }
        if (status === 'dismissed') {
            return 'border-zinc-700/60 bg-zinc-700/10 text-zinc-800';
        }
        return 'border-amber-700/60 bg-amber-700/10 text-amber-800';
    };

    const buildFeedbackHref = (
        nextStatus: 'all' | 'open' | 'resolved' | 'dismissed',
        nextPage: number,
    ) => {
        const qs = new URLSearchParams();
        qs.set('commentsPage', String(currentCommentsPage));
        qs.set('feedbackStatus', nextStatus);
        qs.set('feedbackPage', String(nextPage));
        return `/share/theme/${shareSlug}?${qs.toString()}`;
    };

    const submitRating = async () => {
        if (!canInteract || isSendingRating) return;

        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            setNotice({ tone: 'warn', message: 'El rating debe estar entre 1 y 5.' });
            return;
        }

        if (reviewLength > 800) {
            setNotice({ tone: 'warn', message: 'El comentario no puede superar 800 caracteres.' });
            return;
        }

        setIsSendingRating(true);
        setNotice(null);
        try {
            const response = await fetch(`/api/social/themes/${encodeURIComponent(themeId)}/rate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating, review: review.trim() || undefined }),
            });

            if (!response.ok) {
                const errorMessage = await readApiError(response);
                setNotice({ tone: 'warn', message: `No se pudo enviar rating: ${errorMessage}` });
                return;
            }

            setNotice({ tone: 'ok', message: 'Rating/comentario guardado correctamente.' });
            router.refresh();
        } catch {
            setNotice({ tone: 'warn', message: 'No se pudo enviar rating por un error de red.' });
        } finally {
            setIsSendingRating(false);
        }
    };

    const submitFeedback = async () => {
        if (!canInteract || isSendingFeedback) return;

        if (feedbackLength < 3) {
            setNotice({ tone: 'warn', message: 'El feedback debe tener al menos 3 caracteres.' });
            return;
        }
        if (feedbackLength > 1000) {
            setNotice({ tone: 'warn', message: 'El feedback no puede superar 1000 caracteres.' });
            return;
        }

        setIsSendingFeedback(true);
        setNotice(null);
        try {
            const response = await fetch(`/api/social/themes/${encodeURIComponent(themeId)}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind: feedbackKind, message: feedbackMessage.trim() }),
            });

            if (!response.ok) {
                const errorMessage = await readApiError(response);
                setNotice({ tone: 'warn', message: `No se pudo enviar feedback: ${errorMessage}` });
                return;
            }

            setFeedbackMessage('');
            setNotice({ tone: 'ok', message: 'Feedback enviado. ¡Gracias por aportar!' });
        } catch {
            setNotice({ tone: 'warn', message: 'No se pudo enviar feedback por un error de red.' });
        } finally {
            setIsSendingFeedback(false);
        }
    };

    const submitReport = async () => {
        if (!canInteract || isSendingReport) return;

        if (reportLength > 1000) {
            setNotice({ tone: 'warn', message: 'El detalle del reporte no puede superar 1000 caracteres.' });
            return;
        }

        setIsSendingReport(true);
        setNotice(null);
        try {
            const response = await fetch(`/api/social/themes/${encodeURIComponent(themeId)}/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: reportReason, details: reportDetails.trim() || undefined }),
            });

            if (!response.ok) {
                const errorMessage = await readApiError(response);
                setNotice({ tone: 'warn', message: `No se pudo enviar reporte: ${errorMessage}` });
                return;
            }

            setReportDetails('');
            setNotice({ tone: 'ok', message: 'Reporte enviado a moderación.' });
        } catch {
            setNotice({ tone: 'warn', message: 'No se pudo enviar reporte por un error de red.' });
        } finally {
            setIsSendingReport(false);
        }
    };

    return (
        <section className="border-[2px] border-[#1a1a2e] bg-white p-6 md:p-8 mt-8 space-y-6">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] opacity-60">THEME_INTERACTIONS</div>

            {!isLoggedIn ? (
                <a
                    href={loginHref}
                    className="inline-flex items-center justify-center border-2 border-[#1a1a2e] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all"
                >
                    Iniciá sesión para comentar/ratear/reportar
                </a>
            ) : isOwner ? (
                <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                    Sos el autor de este theme. Rating/feedback/reporte deshabilitados para evitar auto-interacción.
                </div>
            ) : (
                <>
                    <div className="space-y-3 border border-[#1a1a2e]/20 p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em]">RATING + COMENTARIO</div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="theme-rating" className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">Puntaje</label>
                            <select
                                id="theme-rating"
                                value={String(rating)}
                                onChange={(event) => setRating(Number(event.target.value))}
                                className="border border-[#1a1a2e] bg-white px-2 py-1 text-[10px] font-black"
                            >
                                <option value="5">5</option>
                                <option value="4">4</option>
                                <option value="3">3</option>
                                <option value="2">2</option>
                                <option value="1">1</option>
                            </select>
                        </div>
                        <textarea
                            value={review}
                            onChange={(event) => setReview(event.target.value)}
                            maxLength={800}
                            rows={3}
                            placeholder="Comentario opcional sobre el theme..."
                            className="w-full border border-[#1a1a2e]/30 px-3 py-2 text-[11px] font-bold bg-white"
                        />
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">{reviewLength}/800</span>
                            <button
                                type="button"
                                onClick={submitRating}
                                disabled={isSendingRating}
                                className="h-9 px-3 border border-[#1a1a2e] bg-[#f5f1e8] hover:bg-[#1a1a2e] hover:text-[#f5f1e8] disabled:opacity-40 font-black uppercase text-[9px] tracking-wider transition-all"
                            >
                                {isSendingRating ? 'Enviando...' : 'Enviar rating'}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3 border border-[#1a1a2e]/20 p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em]">FEEDBACK</div>
                        <select
                            value={feedbackKind}
                            onChange={(event) => setFeedbackKind(event.target.value as 'issue' | 'suggestion' | 'praise')}
                            className="border border-[#1a1a2e] bg-white px-2 py-1 text-[10px] font-black"
                        >
                            <option value="suggestion">suggestion</option>
                            <option value="issue">issue</option>
                            <option value="praise">praise</option>
                        </select>
                        <textarea
                            value={feedbackMessage}
                            onChange={(event) => setFeedbackMessage(event.target.value)}
                            maxLength={1000}
                            rows={3}
                            placeholder="Contanos tu feedback..."
                            className="w-full border border-[#1a1a2e]/30 px-3 py-2 text-[11px] font-bold bg-white"
                        />
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">{feedbackLength}/1000</span>
                            <button
                                type="button"
                                onClick={submitFeedback}
                                disabled={isSendingFeedback}
                                className="h-9 px-3 border border-[#1a1a2e] bg-[#f5f1e8] hover:bg-[#1a1a2e] hover:text-[#f5f1e8] disabled:opacity-40 font-black uppercase text-[9px] tracking-wider transition-all"
                            >
                                {isSendingFeedback ? 'Enviando...' : 'Enviar feedback'}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3 border border-[#1a1a2e]/20 p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em]">REPORTE</div>
                        <select
                            value={reportReason}
                            onChange={(event) => setReportReason(event.target.value as 'nsfw' | 'hate' | 'spam' | 'impersonation' | 'malware' | 'other')}
                            className="border border-[#1a1a2e] bg-white px-2 py-1 text-[10px] font-black"
                        >
                            <option value="spam">spam</option>
                            <option value="impersonation">impersonation</option>
                            <option value="malware">malware</option>
                            <option value="hate">hate</option>
                            <option value="nsfw">nsfw</option>
                            <option value="other">other</option>
                        </select>
                        <textarea
                            value={reportDetails}
                            onChange={(event) => setReportDetails(event.target.value)}
                            maxLength={1000}
                            rows={2}
                            placeholder="Detalle opcional del reporte"
                            className="w-full border border-[#1a1a2e]/30 px-3 py-2 text-[11px] font-bold bg-white"
                        />
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">{reportLength}/1000</span>
                            <button
                                type="button"
                                onClick={submitReport}
                                disabled={isSendingReport}
                                className="h-9 px-3 border border-[#1a1a2e] bg-[#f5f1e8] hover:bg-red-600 hover:text-white disabled:opacity-40 font-black uppercase text-[9px] tracking-wider transition-all"
                            >
                                {isSendingReport ? 'Enviando...' : 'Reportar'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {isLoggedIn && recentOwnFeedback.length > 0 ? (
                <div className="space-y-3 border border-[#1a1a2e]/20 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em]">MI_FEEDBACK_RECIENTE</div>
                    <div className="flex flex-wrap gap-2">
                        {(['all', 'open', 'resolved', 'dismissed'] as const).map((status) => (
                            <Link
                                key={status}
                                href={buildFeedbackHref(status, 1)}
                                className={`text-[9px] px-2 py-1 border font-black uppercase tracking-[0.2em] transition-all ${ownFeedbackStatus === status ? 'border-[#1a1a2e] bg-[#1a1a2e] text-[#f5f1e8]' : 'border-[#1a1a2e]/40 hover:border-[#1a1a2e] hover:bg-[#1a1a2e] hover:text-[#f5f1e8]'}`}
                            >
                                {status}
                            </Link>
                        ))}
                    </div>
                    <div className="space-y-2">
                        {recentOwnFeedback.map((item) => (
                            <div key={item.id} className="border border-[#1a1a2e]/15 p-2">
                                <div className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-[0.2em] opacity-70">
                                    <span>{item.kind}</span>
                                    <span className={`px-1.5 py-0.5 border ${getStatusBadgeClasses(item.status)}`}>
                                        {item.status}
                                    </span>
                                </div>
                                <p className="text-[10px] font-bold mt-1 whitespace-pre-wrap">{item.message}</p>
                                <div className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40 mt-1">
                                    {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('es-AR') : '-'}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em] opacity-60">
                        <span>Page {ownFeedbackPage}/{ownFeedbackTotalPages}</span>
                        <div className="flex items-center gap-2">
                            {ownFeedbackPage > 1 ? (
                                <Link
                                    href={buildFeedbackHref(ownFeedbackStatus, ownFeedbackPage - 1)}
                                    className="border border-[#1a1a2e]/60 px-2 py-1 hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all"
                                >
                                    Prev
                                </Link>
                            ) : null}
                            {ownFeedbackPage < ownFeedbackTotalPages ? (
                                <Link
                                    href={buildFeedbackHref(ownFeedbackStatus, ownFeedbackPage + 1)}
                                    className="border border-[#1a1a2e]/60 px-2 py-1 hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all"
                                >
                                    Next
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}

            {notice ? (
                <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${notice.tone === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {notice.message}
                </div>
            ) : null}
        </section>
    );
}
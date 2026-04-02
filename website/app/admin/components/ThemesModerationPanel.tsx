'use client';

import { AlertTriangle, CheckCircle2, Clock3, Shield, Slash, Undo2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { handleThemeModerationAction } from '../actions';

type ThemePackModerationItem = {
    id: string;
    slug: string;
    ownerId: string;
    ownerUsername: string | null;
    name: string;
    isSystem: boolean;
    visibility: string;
    status: string;
    moderationMessage: string | null;
    downloadsCount: number;
    appliesCount: number;
    ratingAvg: number;
    ratingCount: number;
    createdAt: string | null;
    updatedAt: string | null;
};

type ThemeReportModerationItem = {
    id: string;
    themePackId: string;
    reporterUserId: string;
    reason: string;
    details: string | null;
    status: string;
    createdAt: string | null;
    updatedAt: string | null;
    themeSlug: string;
    themeName: string;
    themeStatus: string;
    themeIsSystem: boolean;
    ownerId: string;
};

interface ThemesModerationPanelProps {
    themes: ThemePackModerationItem[];
    reports: ThemeReportModerationItem[];
}

function shortDate(value: string | null): string {
    if (!value) return 'n/a';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'n/a';
    return date.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function ThemesModerationPanel({ themes, reports }: ThemesModerationPanelProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
    const [refreshSeconds, setRefreshSeconds] = useState(12);
    const [lastRefreshAt, setLastRefreshAt] = useState<Date>(new Date());
    const activeSection = (searchParams.get('section') as 'queue' | 'reports') || 'queue';
    const activeSource = (searchParams.get('source') as 'all' | 'system' | 'community') || 'all';

    const pendingQueue = themes.filter((item) => item.status === 'pending_review');
    const systemCount = themes.filter((item) => item.isSystem).length;

    useEffect(() => {
        setLastRefreshAt(new Date());
    }, [themes, reports]);

    useEffect(() => {
        if (!autoRefreshEnabled) return;

        const timer = setInterval(() => {
            router.refresh();
        }, refreshSeconds * 1000);

        return () => clearInterval(timer);
    }, [autoRefreshEnabled, refreshSeconds, router]);

    const lastRefreshLabel = useMemo(
        () =>
            lastRefreshAt.toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            }),
        [lastRefreshAt],
    );

    return (
        <div className="space-y-10">
            <div className="flex border-b border-[#1a1a2e]/10">
                <a
                    href="?tab=themes-moderation&section=queue"
                    className={`px-8 py-3 font-black text-xs uppercase transition-all border-b-2 -mb-[1px] ${activeSection === 'queue' ? 'border-[#1a1a2e] text-[#1a1a2e]' : 'border-transparent text-[#1a1a2e]/40 hover:text-[#1a1a2e]'}`}
                >
                    THEMES_QUEUE
                </a>
                <a
                    href="?tab=themes-moderation&section=reports"
                    className={`px-8 py-3 font-black text-xs uppercase transition-all border-b-2 -mb-[1px] ${activeSection === 'reports' ? 'border-[#1a1a2e] text-[#1a1a2e]' : 'border-transparent text-[#1a1a2e]/40 hover:text-[#1a1a2e]'}`}
                >
                    REPORTS_QUEUE
                </a>
            </div>

            <div className="flex flex-wrap gap-2">
                <a
                    href={`?tab=themes-moderation&section=${activeSection}&source=all`}
                    className={`px-3 py-1 border text-[10px] font-black uppercase tracking-wider ${activeSource === 'all' ? 'bg-[#1a1a2e] text-[#f5f1e8] border-[#1a1a2e]' : 'bg-white text-[#1a1a2e] border-[#1a1a2e]/30'}`}
                >
                    ALL
                </a>
                <a
                    href={`?tab=themes-moderation&section=${activeSection}&source=system`}
                    className={`px-3 py-1 border text-[10px] font-black uppercase tracking-wider ${activeSource === 'system' ? 'bg-[#1a1a2e] text-[#f5f1e8] border-[#1a1a2e]' : 'bg-white text-[#1a1a2e] border-[#1a1a2e]/30'}`}
                >
                    SYSTEM ({systemCount})
                </a>
                <a
                    href={`?tab=themes-moderation&section=${activeSection}&source=community`}
                    className={`px-3 py-1 border text-[10px] font-black uppercase tracking-wider ${activeSource === 'community' ? 'bg-[#1a1a2e] text-[#f5f1e8] border-[#1a1a2e]' : 'bg-white text-[#1a1a2e] border-[#1a1a2e]/30'}`}
                >
                    COMMUNITY ({themes.length - systemCount})
                </a>
            </div>

            <div className="flex flex-wrap items-center gap-2 border border-[#1a1a2e]/20 bg-white p-2">
                <button
                    type="button"
                    onClick={() => setAutoRefreshEnabled((value) => !value)}
                    className={`h-8 px-3 border font-black uppercase text-[9px] tracking-wider transition-all ${autoRefreshEnabled ? 'border-[#1a1a2e] bg-[#1a1a2e] text-[#f5f1e8]' : 'border-[#1a1a2e]/30 bg-white text-[#1a1a2e]'}`}
                >
                    {autoRefreshEnabled ? 'REALTIME_ON' : 'REALTIME_OFF'}
                </button>

                <select
                    value={refreshSeconds}
                    onChange={(event) => setRefreshSeconds(Number(event.target.value))}
                    className="h-8 px-2 border border-[#1a1a2e]/30 text-[10px] font-black uppercase bg-white"
                >
                    <option value={8}>8s</option>
                    <option value={12}>12s</option>
                    <option value={20}>20s</option>
                </select>

                <button
                    type="button"
                    onClick={() => router.refresh()}
                    className="h-8 px-3 border border-[#1a1a2e] bg-[#f5f1e8] hover:bg-[#1a1a2e] hover:text-[#f5f1e8] font-black uppercase text-[9px] tracking-wider transition-all"
                >
                    REFRESH_NOW
                </button>

                <span className="text-[9px] font-black uppercase tracking-wider text-[#1a1a2e]/60">LAST_SYNC {lastRefreshLabel}</span>
            </div>

            {activeSection === 'queue' && (
                <div className="space-y-6">
                    <div className="border-2 border-[#1a1a2e] bg-white p-5">
                        <div className="text-xs font-black uppercase tracking-widest text-[#1a1a2e]/70">pending_review</div>
                        <div className="text-3xl font-black tracking-tighter mt-2">{pendingQueue.length}</div>
                    </div>

                    <div className="border border-[#1a1a2e] bg-[#f5f1e8] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[11px] border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-[#1a1a2e] bg-[#1a1a2e] text-[#f5f1e8]">
                                        <th className="p-3 font-black uppercase tracking-widest">Theme</th>
                                        <th className="p-3 font-black uppercase tracking-widest">Owner</th>
                                        <th className="p-3 font-black uppercase tracking-widest">Status</th>
                                        <th className="p-3 font-black uppercase tracking-widest">Signals</th>
                                        <th className="p-3 font-black uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1a1a2e]/10">
                                    {themes.map((item) => (
                                        <tr key={item.id} className="hover:bg-[#1a1a2e]/5 transition-colors align-top">
                                            <td className="p-3">
                                                <div className="font-black uppercase text-sm">{item.name}</div>
                                                {item.isSystem ? (
                                                    <div className="inline-flex mt-1 border border-[#1a1a2e] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">SYSTEM_THEME</div>
                                                ) : null}
                                                <div className="font-mono text-[9px] opacity-50 mt-1">/{item.slug}</div>
                                                {item.moderationMessage ? (
                                                    <div className="text-[9px] text-amber-700 font-bold mt-2 max-w-80">
                                                        {item.moderationMessage}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="p-3">
                                                <div className="font-black">@{item.ownerUsername || 'unknown_node'}</div>
                                                <div className="font-mono text-[9px] opacity-40">{item.ownerId.slice(0, 16)}...</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="inline-flex items-center gap-1.5 border border-[#1a1a2e] px-2 py-1 font-black text-[9px] uppercase tracking-widest">
                                                    <Clock3 className="w-3 h-3" /> {item.status}
                                                </div>
                                                <div className="text-[9px] opacity-50 mt-2">{shortDate(item.updatedAt)}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="text-[9px] font-bold uppercase opacity-70">DL {item.downloadsCount} • Apply {item.appliesCount}</div>
                                                <div className="text-[9px] font-bold uppercase opacity-70 mt-1">⭐ {item.ratingAvg.toFixed(2)} ({item.ratingCount})</div>
                                                <div className="text-[9px] font-bold uppercase opacity-70 mt-1">{item.visibility}</div>
                                            </td>
                                            <td className="p-3 text-right">
                                                <form action={handleThemeModerationAction} className="inline-flex flex-col gap-2 items-end">
                                                    <input type="hidden" name="themePackId" value={item.id} />
                                                    <input type="hidden" name="origin_tab" value="themes-moderation" />
                                                    <input type="hidden" name="origin_section" value="queue" />
                                                    <input type="hidden" name="source" value={activeSource} />

                                                    <input
                                                        type="text"
                                                        name="message"
                                                        placeholder="Mensaje moderación (opcional)"
                                                        className="bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 px-2 py-1 text-[9px] w-48 focus:outline-none focus:border-[#1a1a2e]"
                                                    />

                                                    <div className="flex flex-wrap gap-2 justify-end">
                                                        <button
                                                            type="submit"
                                                            name="intent"
                                                            value="approve"
                                                            className="h-8 px-3 border border-[#1a1a2e] bg-[#f5f1e8] hover:bg-[#1a1a2e] hover:text-[#f5f1e8] font-black uppercase text-[9px] transition-all flex items-center gap-1"
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> APPROVE
                                                        </button>
                                                        <button
                                                            type="submit"
                                                            name="intent"
                                                            value="reject"
                                                            className="h-8 px-3 border border-[#1a1a2e] bg-[#f5f1e8] hover:bg-red-600 hover:text-white font-black uppercase text-[9px] transition-all flex items-center gap-1"
                                                        >
                                                            <Slash className="w-3.5 h-3.5" /> REJECT
                                                        </button>
                                                        <button
                                                            type="submit"
                                                            name="intent"
                                                            value="suspend"
                                                            className="h-8 px-3 border border-[#1a1a2e] bg-[#f5f1e8] hover:bg-amber-500 hover:text-[#1a1a2e] font-black uppercase text-[9px] transition-all flex items-center gap-1"
                                                        >
                                                            <Shield className="w-3.5 h-3.5" /> SUSPEND
                                                        </button>
                                                        <button
                                                            type="submit"
                                                            name="intent"
                                                            value="restore"
                                                            className="h-8 px-3 border border-[#1a1a2e] bg-[#f5f1e8] hover:bg-green-600 hover:text-white font-black uppercase text-[9px] transition-all flex items-center gap-1"
                                                        >
                                                            <Undo2 className="w-3.5 h-3.5" /> RESTORE
                                                        </button>
                                                        <button
                                                            type="submit"
                                                            name="intent"
                                                            value={item.isSystem ? 'unmark-system' : 'mark-system'}
                                                            className="h-8 px-3 border border-[#1a1a2e] bg-[#f5f1e8] hover:bg-indigo-600 hover:text-white font-black uppercase text-[9px] transition-all flex items-center gap-1"
                                                        >
                                                            <Shield className="w-3.5 h-3.5" /> {item.isSystem ? 'UNMARK_SYSTEM' : 'MARK_SYSTEM'}
                                                        </button>
                                                    </div>
                                                </form>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeSection === 'reports' && (
                <div className="border border-[#1a1a2e] bg-[#f5f1e8] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                                <tr className="border-b-2 border-[#1a1a2e] bg-[#1a1a2e] text-[#f5f1e8]">
                                    <th className="p-3 font-black uppercase tracking-widest">Report</th>
                                    <th className="p-3 font-black uppercase tracking-widest">Theme</th>
                                    <th className="p-3 font-black uppercase tracking-widest">Reporter</th>
                                    <th className="p-3 font-black uppercase tracking-widest">Status</th>
                                    <th className="p-3 font-black uppercase tracking-widest text-right">Quick action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1a1a2e]/10">
                                {reports.map((item) => (
                                    <tr key={item.id} className="hover:bg-[#1a1a2e]/5 transition-colors align-top">
                                        <td className="p-3">
                                            <div className="font-black uppercase">{item.reason}</div>
                                            {item.details ? <div className="text-[9px] opacity-70 mt-1 max-w-72">{item.details}</div> : null}
                                            <div className="text-[9px] opacity-40 mt-1">{shortDate(item.createdAt)}</div>
                                        </td>
                                        <td className="p-3">
                                            <div className="font-black">{item.themeName}</div>
                                            {item.themeIsSystem ? <div className="text-[8px] font-black opacity-70 uppercase">SYSTEM_THEME</div> : null}
                                            <div className="font-mono text-[9px] opacity-50">/{item.themeSlug}</div>
                                            <div className="text-[9px] opacity-60 mt-1">theme status: {item.themeStatus}</div>
                                        </td>
                                        <td className="p-3">
                                            <div className="font-mono text-[9px] opacity-70">{item.reporterUserId.slice(0, 16)}...</div>
                                        </td>
                                        <td className="p-3">
                                            <div className="inline-flex items-center gap-1 border border-[#1a1a2e] px-2 py-1 font-black text-[9px] uppercase tracking-widest">
                                                <AlertTriangle className="w-3 h-3" /> {item.status}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <form action={handleThemeModerationAction} className="inline-flex gap-2 items-center">
                                                <input type="hidden" name="themePackId" value={item.themePackId} />
                                                <input type="hidden" name="origin_tab" value="themes-moderation" />
                                                <input type="hidden" name="origin_section" value="reports" />
                                                <input type="hidden" name="source" value={activeSource} />
                                                <button
                                                    type="submit"
                                                    name="intent"
                                                    value="suspend"
                                                    className="h-8 px-3 border border-[#1a1a2e] bg-[#f5f1e8] hover:bg-amber-500 hover:text-[#1a1a2e] font-black uppercase text-[9px] transition-all flex items-center gap-1"
                                                >
                                                    <Shield className="w-3.5 h-3.5" /> SUSPEND_THEME
                                                </button>
                                                <button
                                                    type="submit"
                                                    name="intent"
                                                    value="reject"
                                                    className="h-8 px-3 border border-[#1a1a2e] bg-[#f5f1e8] hover:bg-red-600 hover:text-white font-black uppercase text-[9px] transition-all flex items-center gap-1"
                                                >
                                                    <Slash className="w-3.5 h-3.5" /> REJECT_THEME
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {themes.length === 0 && reports.length === 0 ? (
                <div className="border-2 border-dashed border-[#1a1a2e]/30 p-8 text-center bg-white">
                    <div className="inline-flex items-center gap-2 text-xs font-black uppercase opacity-60 tracking-widest">
                        <CheckCircle2 className="w-4 h-4" /> Moderation queue is empty
                    </div>
                </div>
            ) : null}
        </div>
    );
}

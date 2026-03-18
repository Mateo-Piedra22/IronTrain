'use client';

import { Database, Filter, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';

type WorkoutRow = {
    id: string;
    userId: string;
    username: string | null;
    status: string | null;
    date: number;
    startTime: number;
    endTime: number | null;
    updatedAt: string;
    deletedAt: string | null;
    setCount: number;
};

interface SyncWorkoutsPanelProps {
    workouts: WorkoutRow[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
    };
}

function fmtDateTime(ms: number | null): string {
    if (!ms) return '-';
    try {
        return new Date(ms).toLocaleString('es-AR', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return '-';
    }
}

export default function SyncWorkoutsPanel({ workouts, pagination }: SyncWorkoutsPanelProps) {
    const { currentPage, totalPages, totalItems } = pagination;

    const handlePageChange = (newPage: number) => {
        const url = new URL(window.location.href);
        url.searchParams.set('workoutsPage', newPage.toString());
        window.location.href = url.toString();
    };

    const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all');
    const [showDeleted, setShowDeleted] = useState(false);
    const [onlyWithSets, setOnlyWithSets] = useState(false);

    const filtered = useMemo(() => {
        return (workouts ?? []).filter((w) => {
            if (!showDeleted && w.deletedAt) return false;
            if (statusFilter !== 'all' && w.status !== statusFilter) return false;
            if (onlyWithSets && w.setCount <= 0) return false;
            return true;
        });
    }, [workouts, onlyWithSets, showDeleted, statusFilter]);

    return (
        <div className="space-y-12 animate-in fade-in duration-500">
            <div className="border-2 border-[#1a1a2e] bg-white shadow-[12px_12px_0px_0px_rgba(26,26,46,1)] overflow-hidden">
                <div className="p-4 bg-[#1a1a2e] text-[#f5f1e8] flex items-center gap-3 justify-between">
                    <div className="flex items-center gap-3">
                        <Database className="w-5 h-5" />
                        <h2 className="text-sm font-black uppercase tracking-[0.2em]">SYNC_WORKOUTS_MONITOR ({totalItems})</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage <= 1}
                            className="px-3 py-1 bg-white text-[#1a1a2e] border-2 border-[#1a1a2e] font-black text-[9px] uppercase hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-30 disabled:hover:translate-x-0"
                        >
                            PREV
                        </button>
                        <span className="font-black text-[9px] opacity-60">PAGE_{currentPage}_OF_{totalPages}</span>
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                            className="px-3 py-1 bg-white text-[#1a1a2e] border-2 border-[#1a1a2e] font-black text-[9px] uppercase hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-30 disabled:hover:translate-x-0"
                        >
                            NEXT
                        </button>
                    </div>
                    <div className="hidden md:flex text-[10px] font-black opacity-60 tracking-[0.2em] uppercase items-center gap-2">
                        <RefreshCw className="w-3 h-3" />
                        LIVE_DB_VIEW
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3 text-[10px] font-black uppercase opacity-60 tracking-[0.2em]">
                            <Filter className="w-3 h-3" />
                            FILTERS
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'in_progress' | 'completed')}
                                className="border-2 border-[#1a1a2e] px-3 py-2 text-xs font-black uppercase bg-white"
                            >
                                <option value="all">ALL_STATUS</option>
                                <option value="in_progress">IN_PROGRESS</option>
                                <option value="completed">COMPLETED</option>
                            </select>

                            <button
                                type="button"
                                onClick={() => setOnlyWithSets((v) => !v)}
                                className={`border-2 border-[#1a1a2e] px-3 py-2 text-xs font-black uppercase ${onlyWithSets ? 'bg-[#1a1a2e] text-[#f5f1e8]' : 'bg-white'}`}
                            >
                                ONLY_WITH_SETS
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowDeleted((v) => !v)}
                                className={`border-2 border-[#1a1a2e] px-3 py-2 text-xs font-black uppercase ${showDeleted ? 'bg-[#1a1a2e] text-[#f5f1e8]' : 'bg-white'}`}
                            >
                                SHOW_DELETED
                            </button>
                        </div>
                    </div>

                    <div className="border-2 border-[#1a1a2e] overflow-hidden">
                        <div className="max-h-[520px] overflow-auto">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-[#f5f1e8] border-b-2 border-[#1a1a2e]">
                                    <tr className="text-left">
                                        <th className="p-3 font-black uppercase">WORKOUT_ID</th>
                                        <th className="p-3 font-black uppercase">USER</th>
                                        <th className="p-3 font-black uppercase">STATUS</th>
                                        <th className="p-3 font-black uppercase">SETS</th>
                                        <th className="p-3 font-black uppercase">UPDATED_AT</th>
                                        <th className="p-3 font-black uppercase">DELETED_AT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((w) => (
                                        <tr key={w.id} className="border-b border-[#1a1a2e]/10 hover:bg-[#f5f1e8]/40">
                                            <td className="p-3 font-mono text-[11px]">{w.id}</td>
                                            <td className="p-3">
                                                <div className="font-black">{w.username ? `@${w.username}` : w.userId}</div>
                                                <div className="text-[10px] opacity-40 font-bold">{w.userId}</div>
                                            </td>
                                            <td className="p-3 font-black uppercase">
                                                <span className={`inline-block px-2 py-1 border-2 border-[#1a1a2e] ${w.status === 'completed' ? 'bg-green-200' : 'bg-yellow-100'}`}>
                                                    {w.status || 'unknown'}
                                                </span>
                                            </td>
                                            <td className="p-3 font-black">{w.setCount}</td>
                                            <td className="p-3 font-bold">{fmtDateTime(new Date(w.updatedAt).getTime())}</td>
                                            <td className="p-3 font-bold">{w.deletedAt ? fmtDateTime(new Date(w.deletedAt).getTime()) : '-'}</td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td className="p-6 text-center opacity-50 font-black uppercase" colSpan={6}>
                                                NO_ROWS
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="text-[10px] font-black uppercase opacity-40 tracking-[0.2em]">
                        ROWS: {filtered.length} / {workouts.length}
                    </div>
                </div>
            </div>
        </div>
    );
}

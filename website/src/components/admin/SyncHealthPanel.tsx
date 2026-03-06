'use client';

import { useEffect, useMemo, useState } from 'react';

type OperationHealth = {
    ok: boolean;
    mode: 'native' | 'fallback_db' | 'read_only' | 'unknown';
    reason: string;
};

type SyncHealthReport = {
    generatedAt: string;
    db: {
        driver: string;
        databaseUrlConfigured: boolean;
        pingMs: number | null;
        ok: boolean;
    };
    transaction: {
        hasTransactionMethod: boolean;
        supportsNativeTransaction: boolean;
        mode: 'native' | 'fallback_db';
    };
    operations: {
        pull: OperationHealth;
        push: OperationHealth;
        snapshot: OperationHealth;
        wipe: OperationHealth;
        status: OperationHealth;
    };
    signals: {
        latestUserProfileUpdateAt: string | null;
        latestWorkoutUpdateAt: string | null;
        latestScoreEventAt: string | null;
        latestWipeAuditAt: string | null;
    };
};

type SyncHealthPanelProps = {
    initialReport: SyncHealthReport;
};

export function SyncHealthPanel({ initialReport }: SyncHealthPanelProps) {
    const [report, setReport] = useState<SyncHealthReport>(initialReport);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const formatSignalDate = (value: string | null): string => {
        if (!value) return 'N/A';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString('es-AR');
    };

    const loadLatest = async () => {
        setIsRefreshing(true);
        try {
            const response = await fetch('/api/admin/sync-health', { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok || !data?.report) {
                throw new Error(data?.error || 'No se pudo actualizar el health de sync');
            }
            setReport(data.report as SyncHealthReport);
            setError(null);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Error inesperado';
            setError(message);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        const timer = setInterval(() => {
            loadLatest();
        }, 15000);
        return () => clearInterval(timer);
    }, []);

    const orderedOperations = useMemo(
        () => [
            ['pull', report.operations.pull],
            ['push', report.operations.push],
            ['snapshot', report.operations.snapshot],
            ['wipe', report.operations.wipe],
            ['status', report.operations.status],
        ] as const,
        [report]
    );

    return (
        <div className="mb-12 border border-[#1a1a2e] bg-[#f5f1e8] shadow-[8px_8px_0px_0px_rgba(26,26,46,0.1)]">
            <div className="border-b border-[#1a1a2e] px-5 py-4 flex items-center justify-between gap-4">
                <div>
                    <div className="text-[10px] opacity-60 font-black uppercase tracking-widest">SYNC_HEALTH_LIVE</div>
                    <h2 className="text-lg font-black uppercase tracking-tight mt-1">PUSH_PULL_SNAPSHOT_WIPE_STATUS</h2>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider border ${report.db.ok ? 'bg-green-100 text-green-900 border-green-700' : 'bg-red-100 text-red-900 border-red-700'}`}>
                        DB {report.db.ok ? 'ONLINE' : 'OFFLINE'}
                    </div>
                    <button
                        type="button"
                        onClick={loadLatest}
                        disabled={isRefreshing}
                        className="px-3 py-1 text-[10px] font-black uppercase tracking-wider border border-[#1a1a2e] bg-white disabled:opacity-50"
                    >
                        {isRefreshing ? 'REFRESHING' : 'REFRESH'}
                    </button>
                </div>
            </div>
            {error ? (
                <div className="mx-5 mt-4 border border-red-700 bg-red-100 text-red-900 px-3 py-2 text-[10px] font-black uppercase tracking-wide">
                    SYNC_HEALTH_ERROR: {error}
                </div>
            ) : null}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <div className="border border-[#1a1a2e]/20 p-4 bg-white">
                    <div className="text-[10px] opacity-60 font-black uppercase tracking-widest mb-2">DB_DRIVER</div>
                    <div className="text-xs font-black break-all">{report.db.driver}</div>
                    <div className="text-[10px] opacity-60 mt-3">DATABASE_URL: {report.db.databaseUrlConfigured ? 'SET' : 'MISSING'}</div>
                    <div className="text-[10px] opacity-60">PING_MS: {report.db.pingMs ?? 'N/A'}</div>
                </div>
                {orderedOperations.map(([key, operation]) => (
                    <div key={key} className="border border-[#1a1a2e]/20 p-4 bg-white">
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] opacity-60 font-black uppercase tracking-widest">{key}</div>
                            <span className={`text-[9px] font-black uppercase px-2 py-1 border ${operation.ok ? 'bg-green-100 text-green-900 border-green-700' : 'bg-red-100 text-red-900 border-red-700'}`}>
                                {operation.ok ? 'OK' : 'FAIL'}
                            </span>
                        </div>
                        <div className="text-[10px] mt-3 font-black uppercase tracking-wide">MODE: {operation.mode}</div>
                        <div className="text-[10px] opacity-70 mt-1 leading-relaxed">{operation.reason}</div>
                    </div>
                ))}
            </div>
            <div className="px-5 pb-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-[#1a1a2e]/20 p-4 bg-white">
                    <div className="text-[10px] opacity-60 font-black uppercase tracking-widest mb-3">SYNC_SIGNALS</div>
                    <div className="text-[11px] leading-6">
                        <div><span className="font-black">PROFILE_UPDATE:</span> {formatSignalDate(report.signals.latestUserProfileUpdateAt)}</div>
                        <div><span className="font-black">WORKOUT_UPDATE:</span> {formatSignalDate(report.signals.latestWorkoutUpdateAt)}</div>
                        <div><span className="font-black">SCORE_EVENT:</span> {formatSignalDate(report.signals.latestScoreEventAt)}</div>
                        <div><span className="font-black">WIPE_AUDIT:</span> {formatSignalDate(report.signals.latestWipeAuditAt)}</div>
                    </div>
                </div>
                <div className="border border-[#1a1a2e]/20 p-4 bg-white">
                    <div className="text-[10px] opacity-60 font-black uppercase tracking-widest mb-3">TRANSACTION_ENGINE</div>
                    <div className="text-[11px] leading-6">
                        <div><span className="font-black">MODE:</span> {report.transaction.mode}</div>
                        <div><span className="font-black">HAS_METHOD:</span> {report.transaction.hasTransactionMethod ? 'YES' : 'NO'}</div>
                        <div><span className="font-black">NATIVE_TX:</span> {report.transaction.supportsNativeTransaction ? 'YES' : 'NO'}</div>
                        <div><span className="font-black">GENERATED_AT:</span> {formatSignalDate(report.generatedAt)}</div>
                        <div className="mt-2"><span className="font-black">API:</span> /api/admin/sync-health</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

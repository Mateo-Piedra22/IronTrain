'use client';

import {
    Activity,
    Shield,
    Smartphone,
    Users,
    Zap
} from 'lucide-react';
import { SyncHealthPanel } from '../../../src/components/admin/SyncHealthPanel';

interface SystemStatusPanelProps {
    metrics: {
        installs: number;
        users: number;
        activeEvents: number;
        pendingFeedback: number;
    };
    syncHealth: any;
}

export default function SystemStatusPanel({ metrics, syncHealth }: SystemStatusPanelProps) {
    return (
        <div className="space-y-12 animate-in fade-in duration-500">
            {/* Sync Health Section - Highest Priority */}
            <div className="border border-[#1a1a2e] bg-[#f5f1e8] shadow-[8px_8px_0px_0px_rgba(26,26,46,0.1)] mb-12">
                <div className="p-6 border-b border-[#1a1a2e] bg-[#1a1a2e] text-[#f5f1e8] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-green-400" />
                        <h2 className="text-lg font-black uppercase tracking-[0.2em]">SYNC_ENGINE_PULSE</h2>
                    </div>
                </div>
                <div className="p-1">
                    <SyncHealthPanel initialReport={syncHealth} />
                </div>
            </div>

            {/* Metrics Breakdown (Secondary) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="border border-[#1a1a2e] p-6 bg-white relative group overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-5">
                        <Smartphone size={40} />
                    </div>
                    <div className="text-[10px] font-black uppercase opacity-40 mb-2">DEVICE_PULSE</div>
                    <div className="text-3xl font-black">{metrics.installs}</div>
                    <div className="text-[9px] font-mono opacity-60 mt-2">TOTAL_UNIQUE_INSTALLS</div>
                </div>

                <div className="border border-[#1a1a2e] p-6 bg-white relative group overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-5">
                        <Users size={40} />
                    </div>
                    <div className="text-[10px] font-black uppercase opacity-40 mb-2">AUTH_COHORT</div>
                    <div className="text-3xl font-black">{metrics.users}</div>
                    <div className="text-[9px] font-mono opacity-60 mt-2">REGISTERED_PROFILES</div>
                </div>

                <div className="border border-[#1a1a2e] p-6 bg-white relative group overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10 text-orange-400">
                        <Zap size={40} />
                    </div>
                    <div className="text-[10px] font-black uppercase opacity-40 mb-2">ACTIVE_MULT</div>
                    <div className="text-3xl font-black text-orange-600">{metrics.activeEvents}</div>
                    <div className="text-[9px] font-mono opacity-60 mt-2">GLOBAL_SCORE_MULTIPLIERS</div>
                </div>

                <div className="border border-[#1a1a2e] p-6 bg-white relative group overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10 text-red-400">
                        <Shield size={40} />
                    </div>
                    <div className="text-[10px] font-black uppercase opacity-40 mb-2">FEEDBACK_QUEUE</div>
                    <div className="text-3xl font-black text-red-600">{metrics.pendingFeedback}</div>
                    <div className="text-[9px] font-mono opacity-60 mt-2">PENDING_RESOLUTIONS</div>
                </div>
            </div>

            {/* Additional Telemetry (Placeholder for future stats) */}
            <div className="border border-[#1a1a2e]/10 p-4 text-center bg-[#1a1a2e]/5">
                <div className="text-[9px] font-black uppercase opacity-40 tracking-[0.5em]">SYSTEM_STABLE_NO_ERRORS_DETECTED_V2</div>
            </div>
        </div>
    );
}

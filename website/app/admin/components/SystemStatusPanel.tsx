'use client';

import {
    Activity,
    MessageSquare,
    Power,
    Save,
    Shield,
    Smartphone,
    Users,
    WifiOff,
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
            {/* Control Center - High Impact */}
            <div className="border-2 border-[#1a1a2e] bg-white shadow-[12px_12px_0px_0px_rgba(26,26,46,1)] overflow-hidden">
                <div className="p-4 bg-[#1a1a2e] text-[#f5f1e8] flex items-center gap-3">
                    <Shield className="w-5 h-5" />
                    <h2 className="text-sm font-black uppercase tracking-[0.2em]">GLOBAL_APP_CONTROL</h2>
                </div>

                <div className="p-8 space-y-8">
                    {/* PostHog Feature Flags Notice */}
                    <div className="p-6 bg-[#1a1a2e] text-white border-2 border-[#1a1a2e] shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center gap-4 mb-4">
                            <Zap className="w-8 h-8 text-yellow-400" />
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight">PostHog_Engine_Link</h3>
                                <p className="text-[10px] font-bold opacity-60 uppercase">Control Avanzado y Experimentos</p>
                            </div>
                        </div>
                        <p className="text-sm opacity-80 mb-6 leading-relaxed">
                            Ahora el <span className="font-bold text-yellow-400">Modo Mantenimiento</span> y <span className="font-bold text-yellow-400">Modo Offline</span> se controlan directamente mediante Feature Flags en PostHog. No es necesario desplegar código ni tocar la base de datos.
                        </p>
                        <a
                            href="https://us.posthog.com/project/347728/feature_flags"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-yellow-400 text-[#1a1a2e] px-4 py-2 text-xs font-black uppercase hover:bg-yellow-300 transition-colors"
                        >
                            Manage_Flags_in_PostHog
                            <Activity className="w-3 h-3" />
                        </a>
                    </div>
                </div>
            </div>

            {/* Sync Health Section */}
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

            {/* Metrics Breakdown */}
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

            {/* Additional Telemetry */}
            <div className="border border-[#1a1a2e]/10 p-4 text-center bg-[#1a1a2e]/5">
                <div className="text-[9px] font-black uppercase opacity-40 tracking-[0.5em]">SYSTEM_STABLE_NO_ERRORS_DETECTED_V2</div>
            </div>
        </div>
    );
}

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
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { SyncHealthPanel } from '../../../src/components/admin/SyncHealthPanel';
import { handleUpdateSystemStatus } from '../actions';
import ConfirmModal from './ConfirmModal';

interface SystemStatusPanelProps {
    metrics: {
        installs: number;
        users: number;
        activeEvents: number;
        pendingFeedback: number;
    };
    syncHealth: any;
    systemStatus: {
        maintenanceMode: number;
        offlineOnlyMode: number;
        message: string | null;
        updatedAt?: any;
    };
}

export default function SystemStatusPanel({ metrics, syncHealth, systemStatus }: SystemStatusPanelProps) {
    const [maintenance, setMaintenance] = useState(systemStatus.maintenanceMode === 1);
    const [offlineOnly, setOfflineOnly] = useState(systemStatus.offlineOnlyMode === 1);
    const [message, setMessage] = useState(systemStatus.message || '');
    const [isPending, startTransition] = useTransition();
    const searchParams = useSearchParams();

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant: 'danger' | 'warning' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        variant: 'danger'
    });

    const handleConfirm = (title: string, message: string, onConfirm: () => void, variant: 'danger' | 'warning' | 'info' = 'danger') => {
        setConfirmConfig({ isOpen: true, title, message, onConfirm, variant });
    };

    return (
        <div className="space-y-12 animate-in fade-in duration-500">
            {/* Control Center - High Impact */}
            <div className="border-2 border-[#1a1a2e] bg-white shadow-[12px_12px_0px_0px_rgba(26,26,46,1)] overflow-hidden">
                <div className="p-4 bg-[#1a1a2e] text-[#f5f1e8] flex items-center gap-3">
                    <Shield className="w-5 h-5" />
                    <h2 className="text-sm font-black uppercase tracking-[0.2em]">GLOBAL_APP_CONTROL</h2>
                </div>

                <form 
                    action={handleUpdateSystemStatus} 
                    onSubmit={(e) => {
                        e.preventDefault();
                        const isMaintenanceChanging = maintenance !== (systemStatus.maintenanceMode === 1);
                        const isOfflineOnlyChanging = offlineOnly !== (systemStatus.offlineOnlyMode === 1);

                        if (isMaintenanceChanging || isOfflineOnlyChanging) {
                            handleConfirm(
                                'CAMBIO DE ESTADO GLOBAL',
                                `Estás a punto de cambiar modos críticos del sistema (${isMaintenanceChanging ? 'MAINTENANCE' : ''} ${isOfflineOnlyChanging ? 'OFFLINE_ONLY' : ''}). ¿Confirmar cambios?`,
                                () => {
                                    startTransition(async () => {
                                        const formData = new FormData(e.currentTarget as HTMLFormElement);
                                        await handleUpdateSystemStatus(formData);
                                    });
                                },
                                'warning'
                            );
                        } else {
                            startTransition(async () => {
                                const formData = new FormData(e.currentTarget as HTMLFormElement);
                                await handleUpdateSystemStatus(formData);
                            });
                        }
                    }}
                    className="p-8 space-y-8"
                >
                    <input type="hidden" name="origin_tab" value="system" />
                    <input type="hidden" name="origin_section" value="status" />
                    <input type="hidden" name="maintenanceMode" value={maintenance ? '1' : '0'} />
                    <input type="hidden" name="offlineOnlyMode" value={offlineOnly ? '1' : '0'} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Maintenance Mode Toggle */}
                        <div className={`border-2 p-6 transition-all duration-300 ${maintenance ? 'border-red-600 bg-red-50' : 'border-[#1a1a2e]/10 bg-[#f5f1e8]/30'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <Power className={`w-6 h-6 ${maintenance ? 'text-red-600' : 'opacity-40'}`} />
                                    <div>
                                        <h3 className="font-black uppercase text-sm leading-none">MAINTENANCE_MODE</h3>
                                        <p className="text-[9px] font-bold opacity-40 mt-1 uppercase">Bloquear acceso total a la app</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setMaintenance(!maintenance)}
                                    className={`w-14 h-8 border-2 border-[#1a1a2e] relative transition-colors duration-300 ${maintenance ? 'bg-red-600' : 'bg-gray-200'}`}
                                >
                                    <div className={`absolute top-0.5 bottom-0.5 w-6 bg-white border border-[#1a1a2e] transition-all duration-300 ${maintenance ? 'left-6.5' : 'left-0.5'}`} />
                                </button>
                            </div>
                        </div>

                        {/* Offline Only Mode Toggle */}
                        <div className={`border-2 p-6 transition-all duration-300 ${offlineOnly ? 'border-orange-600 bg-orange-50' : 'border-[#1a1a2e]/10 bg-[#f5f1e8]/30'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <WifiOff className={`w-6 h-6 ${offlineOnly ? 'text-orange-600' : 'opacity-40'}`} />
                                    <div>
                                        <h3 className="font-black uppercase text-sm leading-none">OFFLINE_FORCED</h3>
                                        <p className="text-[9px] font-bold opacity-40 mt-1 uppercase">Desactivar sincronización global</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOfflineOnly(!offlineOnly)}
                                    className={`w-14 h-8 border-2 border-[#1a1a2e] relative transition-colors duration-300 ${offlineOnly ? 'bg-orange-600' : 'bg-gray-200'}`}
                                >
                                    <div className={`absolute top-0.5 bottom-0.5 w-6 bg-white border border-[#1a1a2e] transition-all duration-300 ${offlineOnly ? 'left-6.5' : 'left-0.5'}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                            <MessageSquare className="w-3 h-3" />
                            MAINTENANCE_LOG_MESSAGE
                        </label>
                        <textarea
                            name="message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Ej: Estamos realizando mejoras en el motor de sincronización..."
                            className="w-full border-2 border-[#1a1a2e] p-4 font-mono text-sm focus:bg-[#f5f1e8] outline-none min-h-[100px] resize-none"
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="bg-[#1a1a2e] text-[#f5f1e8] px-8 py-3 font-black uppercase tracking-widest text-xs flex items-center gap-3 hover:translate-x-1 hover:-translate-y-1 transition-transform active:translate-x-0 active:translate-y-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {isPending ? 'APPLYING...' : 'APPLY_GLOBAL_CHANGES'}
                        </button>
                    </div>
                </form>
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

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                variant={confirmConfig.variant}
            />
        </div>
    );
}

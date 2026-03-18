'use client';

import { Hammer, ShieldAlert } from 'lucide-react';
import { useFeatureFlagEnabled } from 'posthog-js/react';

export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
    const isMaintenanceMode = useFeatureFlagEnabled('maintenance-mode');

    if (isMaintenanceMode) {
        return (
            <div className="fixed inset-0 z-[9999] bg-[#f5f1e8] flex items-center justify-center p-6 font-mono">
                <div className="max-w-xl w-full border-4 border-[#1a1a2e] bg-white p-12 shadow-[16px_16px_0px_0px_rgba(26,26,46,1)] text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-red-600 animate-pulse" />

                    <div className="flex justify-center mb-8">
                        <div className="bg-[#1a1a2e] p-4 text-[#f5f1e8] rounded-xl transform rotate-3">
                            <Hammer className="w-12 h-12" />
                        </div>
                    </div>

                    <h1 className="text-4xl font-black uppercase tracking-tighter mb-4 text-[#1a1a2e]">
                        SYSTEM_UNDER_REPAIR
                    </h1>

                    <div className="flex items-center justify-center gap-2 mb-8 text-xs font-bold uppercase tracking-widest text-[#1a1a2e]/40">
                        <ShieldAlert className="w-4 h-4" />
                        Protocolo de Mantenimiento Activo
                    </div>

                    <p className="text-sm font-bold leading-relaxed mb-8 text-[#1a1a2e]/60">
                        Estamos realizando mejoras críticas en el motor de IronTrain.
                        Este proceso es necesario para garantizar la integridad de tus datos y la velocidad de sincronización.
                    </p>

                    <div className="p-4 bg-[#f8f9fa] border-2 border-dashed border-[#1a1a2e] mb-8">
                        <div className="text-[10px] font-black uppercase opacity-60">Status_Code</div>
                        <div className="text-sm font-bold">503_SERVICE_TEMPORARILY_UNAVAILABLE</div>
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">
                        VOLVEREMOS_PRONTO • GRACIAS_POR_TU_PACIENCIA
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

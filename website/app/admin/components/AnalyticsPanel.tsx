'use client';

import {
    Activity,
    ArrowUpRight,
    ExternalLink,
    Target,
    TrendingUp,
    Users,
    Zap
} from 'lucide-react';

export default function AnalyticsPanel() {
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

    // These should be replaced with actual project IDs or slug-based URLs if available
    const dashboards = [
        {
            title: 'Resumen de Retención',
            description: 'Usuarios que regresan semana tras semana.',
            icon: Users,
            url: `${posthogHost}/dashboard`,
            color: 'text-blue-600',
            bg: 'bg-blue-50'
        },
        {
            title: 'Conversión de Registro',
            description: 'Embudo desde descarga hasta primer entrenamiento.',
            icon: Target,
            url: `${posthogHost}/insights`,
            color: 'text-green-600',
            bg: 'bg-green-50'
        },
        {
            title: 'Salud del Sistema (Sync)',
            description: 'Métricas de éxito y latencia de sincronización.',
            icon: Activity,
            url: `${posthogHost}/events`,
            color: 'text-purple-600',
            bg: 'bg-purple-50'
        },
        {
            title: 'Adopción de Funciones',
            description: 'Uso de IronSocial, PR Center y Rutinas.',
            icon: Zap,
            url: `${posthogHost}/trends`,
            color: 'text-orange-600',
            bg: 'bg-orange-50'
        }
    ];

    return (
        <div className="space-y-6">
            <div className="border-4 border-[#1a1a2e] p-8 bg-white shadow-[8px_8px_0px_0px_rgba(26,26,46,1)]">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-red-100 rounded-lg">
                        <TrendingUp className="w-8 h-8 text-red-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">ANALYTICS_COMMAND_CENTER</h2>
                        <p className="text-xs font-bold text-[#1a1a2e]/60 uppercase tracking-widest">PostHog Professional Instrumentation</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dashboards.map((dash) => (
                        <a
                            key={dash.title}
                            href={dash.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-start gap-4 p-6 border-2 border-[#1a1a2e] hover:bg-[#1a1a2e] transition-all relative overflow-hidden"
                        >
                            <div className={`p-3 rounded-lg ${dash.bg} group-hover:bg-white/10 transition-colors`}>
                                <dash.icon className={`w-6 h-6 ${dash.color} group-hover:text-white`} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-black uppercase text-sm mb-1 group-hover:text-white transition-colors">{dash.title}</h3>
                                <p className="text-xs font-medium text-[#1a1a2e]/60 group-hover:text-white/60 transition-colors leading-relaxed">
                                    {dash.description}
                                </p>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-[#1a1a2e]/20 group-hover:text-white/40 transition-colors absolute top-4 right-4" />
                        </a>
                    ))}
                </div>

                <div className="mt-8 pt-8 border-t-2 border-[#1a1a2e]/5">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="space-y-1">
                            <h4 className="text-xs font-black uppercase tracking-widest">Acceso Directo a PostHog Cloud</h4>
                            <p className="text-[10px] font-bold text-[#1a1a2e]/40 uppercase">Requiere autenticación en la plataforma PostHog para ver los datos privados.</p>
                        </div>
                        <a
                            href={posthogHost}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-6 py-3 bg-[#1a1a2e] text-white text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-colors"
                        >
                            Abrir Consola de Datos <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="border-4 border-[#1a1a2e] p-6 bg-white shadow-[4px_4px_0px_0px_rgba(26,26,46,1)]">
                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-40">Status: Monitoring</h4>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs font-bold uppercase">
                            <span>Eventos (24h)</span>
                            <span className="text-green-600">Proximity Active</span>
                        </div>
                        <div className="h-1.5 bg-[#1a1a2e]/5 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 w-[85%]" />
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 border-4 border-[#1a1a2e] p-6 bg-[#1a1a2e] text-[#f5f1e8] shadow-[4px_4px_0px_0px_rgba(26,26,46,1)]">
                    <div className="flex items-center gap-4">
                        <Activity className="w-5 h-5 text-red-500" />
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-tighter opacity-60">Insight Automático</p>
                            <p className="text-xs font-bold">Los eventos de sincronización han mejorado un 12% desde la última optimización del SyncService.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

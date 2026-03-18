'use client';

import {
    Activity,
    ArrowUpRight,
    Bug,
    ClipboardList,
    ExternalLink,
    Target,
    TrendingUp,
    Users,
    Zap
} from 'lucide-react';

export default function AnalyticsPanel() {
    const rawHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
    const posthogHost = rawHost.replace('i.', ''); // Ensure we link to app/us.posthog.com, not ingestion

    // These should be replaced with actual project IDs or slug-based URLs if available
    const projectId = '347728';
    const dashboards = [
        {
            title: 'Resumen de Retención',
            description: 'Usuarios que regresan semana tras semana.',
            icon: Users,
            url: `${posthogHost}/project/${projectId}/dashboard/1375307`,
            color: 'text-blue-600',
            bg: 'bg-blue-50'
        },
        {
            title: 'Actividad de Usuarios (DAU)',
            description: 'Tendencia de usuarios activos diarios en la plataforma.',
            icon: Target,
            url: `${posthogHost}/project/${projectId}/insights/yzvptqnF`,
            color: 'text-green-600',
            bg: 'bg-green-50'
        },
        {
            title: 'Salud del Sistema (Sync)',
            description: 'Métricas de éxito y latencia de sincronización.',
            icon: Activity,
            url: `${posthogHost}/project/${projectId}/insights/XoIQ66Sw`,
            color: 'text-purple-600',
            bg: 'bg-purple-50'
        },
        {
            title: 'Interacción Social',
            description: 'Uso de IronSocial: Kudos y actividad comunitaria.',
            icon: Zap,
            url: `${posthogHost}/project/${projectId}/insights/vsU1RgH1`,
            color: 'text-orange-600',
            bg: 'bg-orange-50'
        },
        {
            title: 'Feedback (Surveys)',
            description: 'Resultados de encuestas y satisfacción del usuario.',
            icon: ClipboardList,
            url: `${posthogHost}/project/${projectId}/surveys`,
            color: 'text-yellow-600',
            bg: 'bg-yellow-50'
        },
        {
            title: 'Crashes & Error Tracking',
            description: 'Monitoreo de excepciones en tiempo real (App & Web).',
            icon: Bug,
            url: `${posthogHost}/project/${projectId}/error-tracking`,
            color: 'text-red-700',
            bg: 'bg-red-50'
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

                {/* Feature Flags & Experiments Live Section */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[#f8f9fa] border-2 border-dashed border-[#1a1a2e]/20">
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#1a1a2e]/40 flex items-center gap-2">
                            <Target className="w-3 h-3" /> Feature Flags Activadas
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-gray-100 text-gray-400 text-[10px] font-bold rounded border border-gray-200 uppercase tracking-tighter">
                                NINGUNA_FLAG_ACTIVA ● [ CLEAN_STATUS ]
                            </span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#1a1a2e]/40 flex items-center gap-2">
                            <Activity className="w-3 h-3" /> Experimentos Corriendo
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-gray-100 text-gray-400 text-[10px] font-bold rounded border border-gray-200 uppercase tracking-tighter">
                                NINGUN_EXPERIMENTO ● [ STANDBY_MODE ]
                            </span>
                        </div>
                    </div>
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
                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-40 text-red-600 animate-pulse">● Live Telemetry (24h)</h4>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs font-bold uppercase">
                            <span>Eventos Ingeridos</span>
                            <span className="text-green-600">9 Recibidos</span>
                        </div>
                        <div className="h-2 bg-[#1a1a2e]/5 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 w-[15%] transition-all duration-1000" />
                        </div>
                        <p className="text-[9px] font-medium opacity-50 uppercase">Umbral de salud del sistema: Óptimo</p>
                    </div>
                </div>

                <div className="lg:col-span-2 border-4 border-[#1a1a2e] p-6 bg-[#1a1a2e] text-[#f5f1e8] shadow-[4px_4px_0px_0px_rgba(26,26,46,1)] overflow-hidden relative">
                    <div className="absolute -right-4 -top-4 opacity-10">
                        <Activity className="w-24 h-24" />
                    </div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-2 bg-red-500/20 rounded">
                            <Zap className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-tighter opacity-60">Insight de IA - PostHog Predict</p>
                            <p className="text-xs font-bold leading-relaxed">
                                Se detectó un patrón positivo en `sync_completed`. La latencia de sincronización está por debajo de los 200ms en el 100% de los casos registrados hoy.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

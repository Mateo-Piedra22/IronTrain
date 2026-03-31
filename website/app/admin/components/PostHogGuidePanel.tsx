'use client';

import { BookOpen, Flag, Globe, Info, Smartphone, Terminal, Zap } from 'lucide-react';

export default function PostHogGuidePanel() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header Section */}
            <div className="border-4 border-[#1a1a2e] bg-[#1a1a2e] p-8 text-[#f5f1e8]">
                <div className="flex items-center gap-4 mb-4">
                    <BookOpen className="w-10 h-10" />
                    <div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter">GUIA_POSTHOG_DEVELOPER</h2>
                        <p className="text-[10px] font-bold opacity-60 tracking-widest uppercase">Protocolos de Implementación v1.0</p>
                    </div>
                </div>
                <p className="max-w-2xl text-sm leading-relaxed opacity-80">
                    Esta guía explica cómo integrar Feature Flags, Experimentos y Eventos en el ecosistema de IronTrain.
                    PostHog es nuestro cerebro de decisiones en tiempo real.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 1. Feature Flags Section */}
                <div className="border-4 border-[#1a1a2e] bg-white p-6 shadow-[8px_8px_0px_0px_rgba(26,26,46,1)]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-red-100 p-2 text-red-600">
                            <Flag className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight">Feature Flags</h3>
                    </div>

                    <div className="space-y-6">
                        <section>
                            <div className="flex items-center gap-2 mb-2">
                                <Globe className="w-4 h-4 text-blue-600" />
                                <span className="text-[10px] font-black uppercase text-blue-600">Web (Next.js)</span>
                            </div>
                            <div className="bg-[#1a1a2e] p-4 font-mono text-[11px] text-green-400 overflow-x-auto">
                                <p className="opacity-40 mb-2">// Importar el componente optimizado</p>
                                <p>import PostHogFeatures from '@/components/PostHogFeatures';</p>
                                <br />
                                <p className="opacity-40 mb-2">// Uso dentro de componentes</p>
                                <p>const features = usePostHogFeatures();</p>
                                <p>if (features['mi-nueva-flag']) {'{'}</p>
                                <p>  return &lt;NuevaUI /&gt;;</p>
                                <p>{'}'}</p>
                            </div>
                        </section>

                        <section>
                            <div className="flex items-center gap-2 mb-2">
                                <Smartphone className="w-4 h-4 text-purple-600" />
                                <span className="text-[10px] font-black uppercase text-purple-600">Mobile (Expo)</span>
                            </div>
                            <div className="bg-[#1a1a2e] p-4 font-mono text-[11px] text-green-400 overflow-x-auto">
                                <p className="opacity-40 mb-2">// Usar el wrapper de analytics</p>
                                <p>import {'{'} isFeatureFlagEnabled {'}'} from '@/utils/analytics';</p>
                                <br />
                                <p>if (isFeatureFlagEnabled('mi-nueva-flag')) {'{'}</p>
                                <p>  return &lt;BetaFeature /&gt;;</p>
                                <p>{'}'}</p>
                            </div>
                        </section>
                    </div>
                </div>

                {/* 2. Experiments Section */}
                <div className="border-4 border-[#1a1a2e] bg-white p-6 shadow-[8px_8px_0px_0px_rgba(26,26,46,1)]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-yellow-100 p-2 text-yellow-600">
                            <Zap className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight">Experimentos A/B</h3>
                    </div>

                    <div className="space-y-6">
                        <section>
                            <p className="text-xs font-bold mb-4 opacity-70">Los experimentos usan flags multivariante. El código decide qué variante mostrar.</p>
                            <div className="bg-[#1a1a2e] p-4 font-mono text-[11px] text-green-400 overflow-x-auto">
                                <p className="opacity-40 mb-2">// Obtener el valor de la variante</p>
                                <p>const variant = getFeatureFlag('workout-layout-exp');</p>
                                <br />
                                <p>if (variant === 'test') {'{'}</p>
                                <p>  return &lt;DesignNuevo /&gt;;</p>
                                <p>{'}'} else {'{'}</p>
                                <p>  return &lt;DesignOriginal /&gt;;</p>
                                <p>{'}'}</p>
                            </div>
                        </section>

                        <div className="bg-blue-50 border-l-4 border-blue-600 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Info className="w-4 h-4 text-blue-600" />
                                <span className="text-[10px] font-black uppercase text-blue-600">Dato Clave</span>
                            </div>
                            <p className="text-[10px] leading-relaxed text-blue-900 font-bold">
                                Asegurate de que el nombre de la variante en el código coincida exactamente
                                con el "Variant Key" definido en el Dashboard de PostHog.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3. Event Tracking */}
                <div className="border-4 border-[#1a1a2e] bg-white p-6 shadow-[8px_8px_0px_0px_rgba(26,26,46,1)] md:col-span-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-green-100 p-2 text-green-600">
                            <Terminal className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight">Event Tracking (Analytics)</h3>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <p className="text-xs font-bold opacity-70 italic">Usalo para medir el éxito de tus experimentos.</p>
                            <div className="bg-[#1a1a2e] p-4 font-mono text-[11px] text-green-400 overflow-x-auto">
                                <p className="opacity-40 mb-2">// Trackear una acción del usuario</p>
                                <p>posthog.capture('workout_started', {'{'}</p>
                                <p>  difficulty: 'hard',</p>
                                <p>  routine_id: '123'</p>
                                <p>{'}'});</p>
                            </div>
                        </div>

                        <div className="bg-[#f5f1e8] p-6 border-2 border-[#1a1a2e] border-dashed">
                            <h4 className="text-[10px] font-black uppercase mb-4 tracking-widest">Protocolo de Nombrado</h4>
                            <ul className="space-y-3 text-[11px] font-bold uppercase opacity-80">
                                <li className="flex items-center gap-2 text-red-600">
                                    <span className="w-2 h-2 bg-red-600"></span> Evitar CamelCase: `UserLogged` ❌
                                </li>
                                <li className="flex items-center gap-2 text-green-600">
                                    <span className="w-2 h-2 bg-green-600"></span> Usar snake_case: `user_logged` ✅
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-[#1a1a2e]"></span> Ser específico: `clicked_premium_button` ✅
                                </li>
                            </ul>

                            <div className="mt-6 border-t-2 border-[#1a1a2e] pt-4">
                                <h5 className="text-[10px] font-black uppercase mb-3 tracking-widest">Realtime Social (Nuevos)</h5>
                                <ul className="space-y-2 text-[10px] font-bold opacity-80 normal-case">
                                    <li>• `social_realtime_started`</li>
                                    <li>• `social_realtime_transport_changed` (`sse` / `polling`)</li>
                                    <li>• `social_realtime_stale_detected`</li>
                                    <li>• `social_realtime_recovered`</li>
                                    <li>• `social_realtime_stream_error` / `social_realtime_sync_error`</li>
                                    <li>• `social_stream_connected` / `social_stream_closed` (server)</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Admin Footer Tip */}
            <div className="text-center pb-8">
                <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.4em]">
                    IronTrain Engineering ● Knowledge Hub 2026
                </p>
            </div>
        </div>
    );
}

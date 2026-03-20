'use client';

import {
    Activity,
    CheckCircle,
    Clock,
    EyeOff,
    Hash,
    Shield,
    Trash2,
    User,
    Zap
} from 'lucide-react';
import { handleRoutineAction } from '../actions';

interface CommunityModerationPanelProps {
    routines: any[];
}

export default function CommunityModerationPanel({ routines }: CommunityModerationPanelProps) {
    return (
        <div className="space-y-12">
            {/* PUBLIC_ROUTINES_MODERATION */}
            <div>
                <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a2e]/10 pb-2">
                    <Shield className="w-5 h-5" />
                    <h2 className="text-lg font-black uppercase tracking-tight">PUBLIC_ROUTINES_MODERATION</h2>
                </div>

                <div className="border border-[#1a1a2e] bg-[#f5f1e8] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                                <tr className="border-b-2 border-[#1a1a2e] bg-[#1a1a2e] text-[#f5f1e8]">
                                    <th className="p-4 font-black uppercase tracking-widest">IDENTIFIER</th>
                                    <th className="p-4 font-black uppercase tracking-widest">AUTHOR</th>
                                    <th className="p-4 font-black uppercase tracking-widest">VISIBILITY</th>
                                    <th className="p-4 font-black uppercase tracking-widest text-right">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1a1a2e]/10">
                                {routines.map(r => (
                                    <tr key={r.id} className="hover:bg-[#1a1a2e]/5 transition-colors group">
                                        <td className="p-4">
                                            <div className="font-black uppercase tracking-tighter text-sm mb-1">{r.name}</div>
                                            <div className="opacity-40 flex items-center gap-1 font-mono text-[9px]">
                                                <Hash className="w-2.5 h-2.5" /> {r.id}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-black text-[#1a1a2e] flex items-center gap-1">
                                                <User className="w-3 h-3 opacity-40" /> @{r.username || 'unknown_node'}
                                            </div>
                                            <div className="text-[9px] opacity-40 font-mono mt-1">{r.userId.slice(0, 16)}...</div>
                                        </td>
                                        <td className="p-4">
                                            {r.isPublic ? (
                                                <div className="inline-flex items-center gap-1.5 bg-[#1a1a2e] text-[#f5f1e8] px-2 py-0.5 font-black text-[9px] tracking-widest">
                                                    <Zap className="w-2.5 h-2.5" /> PÚBLICA
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-1.5 border border-[#1a1a2e] px-2 py-0.5 font-black text-[9px] tracking-widest opacity-40">
                                                    <Clock className="w-2.5 h-2.5" /> PRIVADA
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <form action={handleRoutineAction} className="inline-flex flex-col gap-2 items-end">
                                                <input type="hidden" name="id" value={r.id} />
                                                <input type="hidden" name="currentModerated" value={r.isModerated ? '1' : '0'} />

                                                {!r.isModerated && (
                                                    <input
                                                        type="text"
                                                        name="message"
                                                        placeholder="Motivo (opcional)..."
                                                        className="bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 px-2 py-1 text-[9px] w-32 focus:outline-none focus:border-[#1a1a2e]"
                                                    />
                                                )}

                                                {r.moderationMessage && (
                                                    <div className="text-[8px] text-amber-600 font-bold max-w-[120px] leading-tight mb-1 italic">
                                                        "{r.moderationMessage}"
                                                    </div>
                                                )}

                                                <div className="flex gap-2">
                                                    <button
                                                        type="submit"
                                                        name="intent"
                                                        value="toggle-moderation"
                                                        className={`h-8 px-3 border border-[#1a1a2e] font-black uppercase text-[9px] transition-all flex items-center gap-2 ${r.isModerated ? 'bg-amber-400 hover:bg-[#1a1a2e] hover:text-[#f5f1e8]' : 'bg-[#f5f1e8] hover:bg-[#1a1a2e] hover:text-[#f5f1e8]'}`}
                                                        title={r.isModerated ? "Mostrar en feed" : "Ocultar en feed"}
                                                    >
                                                        {r.isModerated ? <CheckCircle className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                                        {r.isModerated ? 'HABILITAR' : 'OCULTAR'}
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        name="intent"
                                                        value="purge"
                                                        className="h-8 w-8 border border-[#1a1a2e] bg-[#f5f1e8] hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                                                        title="Eliminar rutina permanentemente"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
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

            {/* FEEDBACK_MANAGEMENT */}
            <div>
                <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a2e]/10 pb-2">
                    <Activity className="w-5 h-5" />
                    <h2 className="text-lg font-black uppercase tracking-tight">COMMUNITY_FEEDBACK_&_REPORTS</h2>
                </div>

                <div className="border-2 border-[#1a1a2e] bg-[#1a1a2e] text-[#f5f1e8] p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-4 mb-4">
                        <Zap className="w-8 h-8 text-yellow-400" />
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight">PostHog_Surveys_Engine</h3>
                            <p className="text-[10px] font-bold opacity-60 uppercase">Feedback Reubicado</p>
                        </div>
                    </div>
                    <p className="text-sm opacity-80 mb-6 leading-relaxed max-w-2xl">
                        El sistema de feedback ha sido migrado a <strong>PostHog Surveys</strong>. 
                        Ahora todos los reportes de bugs y sugerencias se vinculan automáticamente con 
                        las grabaciones de sesión (Session Replay) para entender exactamente qué hizo 
                        el usuario antes del error.
                    </p>
                    <a
                        href="https://us.posthog.com/project/347728/surveys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-yellow-400 text-[#1a1a2e] px-6 py-3 text-xs font-black uppercase hover:bg-yellow-300 transition-colors"
                    >
                        Ver Feedback en PostHog
                        <Zap className="w-4 h-4" />
                    </a>
                </div>
            </div>
        </div>
    );
}

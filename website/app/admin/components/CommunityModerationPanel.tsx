'use client';

import {
    Activity,
    Check,
    CheckCircle,
    Clock,
    EyeOff,
    Hash,
    Shield,
    Trash2,
    User,
    Zap
} from 'lucide-react';
import { handleRoutineAction, markFeedbackStatus } from '../actions';

interface CommunityModerationPanelProps {
    routines: any[];
    feedback: any[];
}

export default function CommunityModerationPanel({ routines, feedback }: CommunityModerationPanelProps) {
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {feedback.map(f => (
                        <div key={f.id} className={`border-2 border-[#1a1a2e] bg-white p-4 relative hover:shadow-[4px_4px_0px_0px_rgba(26,26,46,0.1)] transition-all ${f.status === 'resolved' ? 'opacity-50' : ''}`}>
                            <div className="flex items-center justify-between mb-3 border-b border-[#1a1a2e]/5 pb-2">
                                <div className="text-[10px] font-black opacity-40 uppercase tracking-widest">{f.type || 'FEEDBACK'}</div>
                                <div className="text-[9px] font-mono opacity-40">{new Date(f.createdAt).toLocaleDateString()}</div>
                            </div>

                            <p className="text-xs font-bold leading-tight mb-4 min-h-[40px]">"{f.message}"</p>

                            <div className="flex items-center justify-between mt-auto">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-[#1a1a2e]/10 flex items-center justify-center">
                                        <User className="w-3 h-3 opacity-40" />
                                    </div>
                                    <div className="text-[9px] font-black uppercase truncate max-w-[80px]">{f.userId ? f.userId.slice(0, 8) : 'anon_node'}</div>
                                </div>

                                {f.status !== 'resolved' ? (
                                    <form action={markFeedbackStatus}>
                                        <input type="hidden" name="id" value={f.id} />
                                        <button type="submit" className="flex items-center gap-1 bg-green-400 px-2 py-1 text-[8px] font-black uppercase hover:bg-[#1a1a2e] hover:text-white transition-colors">
                                            <Check className="w-3 h-3" /> MARK_SOLVED
                                        </button>
                                    </form>
                                ) : (
                                    <div className="flex items-center gap-1 text-green-600 px-2 py-1 text-[8px] font-black uppercase">
                                        <CheckCircle className="w-3 h-3" /> SOLVED
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

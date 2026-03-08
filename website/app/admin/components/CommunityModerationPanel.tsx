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
                                                        name="action"
                                                        value="toggle-moderation"
                                                        className={`h-8 px-3 border border-[#1a1a2e] font-black uppercase text-[9px] transition-all flex items-center gap-2 ${r.isModerated ? 'bg-amber-400 hover:bg-[#1a1a2e] hover:text-[#f5f1e8]' : 'bg-[#f5f1e8] hover:bg-[#1a1a2e] hover:text-[#f5f1e8]'}`}
                                                        title={r.isModerated ? "Mostrar en feed" : "Ocultar en feed"}
                                                    >
                                                        {r.isModerated ? <CheckCircle className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                                        {r.isModerated ? 'HABILITAR' : 'OCULTAR'}
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        name="action"
                                                        value="purge"
                                                        className="h-8 px-3 bg-red-500 text-white font-black uppercase text-[9px] hover:bg-red-600 transition-all flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                                        title="Eliminar permanentemente"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> PURGA
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

            {/* SYSTEM_REPORTS_FEEDBACK */}
            <div>
                <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a2e]/10 pb-2">
                    <Activity className="w-5 h-5" />
                    <h2 className="text-lg font-black uppercase tracking-tight">SYSTEM_REPORTS_FEEDBACK</h2>
                </div>

                <div className="border border-[#1a1a2e] bg-[#f5f1e8] shadow-[4px_4px_0px_0px_rgba(26,26,46,0.05)]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                                <tr className="border-b border-[#1a1a2e] bg-[#1a1a2e]/5">
                                    <th className="p-4 font-black uppercase tracking-widest opacity-60">TYPE</th>
                                    <th className="p-4 font-black uppercase tracking-widest opacity-60">CONTENT_LOG</th>
                                    <th className="p-4 font-black uppercase tracking-widest opacity-60">STATUS</th>
                                    <th className="p-4 font-black uppercase tracking-widest opacity-60 text-right">FLOW</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1a1a2e]/10">
                                {feedback.map(f => (
                                    <tr key={f.id} className="hover:bg-white transition-colors">
                                        <td className="p-4">
                                            <div className={`inline-block px-1.5 py-0.5 font-black text-[9px] uppercase tracking-tighter ${f.type === 'bug' ? 'bg-red-100 text-red-600' :
                                                f.type === 'feature_request' ? 'bg-orange-100 text-orange-600' :
                                                    'bg-blue-100 text-blue-600'
                                                }`}>
                                                {f.type}
                                            </div>
                                        </td>
                                        <td className="p-4 max-w-lg">
                                            <p className="font-bold leading-tight uppercase tracking-tight text-[#1a1a2e]">{f.message}</p>
                                            <div className="mt-2 text-[10px] font-black uppercase tracking-wide flex flex-wrap items-center gap-2">
                                                <span className="border border-[#1a1a2e]/20 bg-white px-1.5 py-0.5">FROM: {f.senderName}</span>
                                                {f.metadata?.subject ? <span className="border border-[#1a1a2e]/20 bg-white px-1.5 py-0.5">SUBJECT: {String(f.metadata.subject)}</span> : null}
                                                {f.metadata?.platform ? <span className="border border-[#1a1a2e]/20 bg-white px-1.5 py-0.5">PLATFORM: {String(f.metadata.platform)}</span> : null}
                                                {f.metadata?.appVersion ? <span className="border border-[#1a1a2e]/20 bg-white px-1.5 py-0.5">APP: {String(f.metadata.appVersion)}</span> : null}
                                                {f.metadata?.contactEmail ? <span className="border border-[#1a1a2e]/20 bg-white px-1.5 py-0.5">CONTACT: {String(f.metadata.contactEmail)}</span> : null}
                                            </div>
                                            <div className="text-[9px] opacity-30 mt-2 font-mono flex items-center gap-1">
                                                <Clock className="w-2.5 h-2.5" /> {new Date(f.createdAt).toISOString()}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {f.status === 'open' ? (
                                                <div className="text-orange-500 font-black animate-pulse flex items-center gap-1">
                                                    <Activity className="w-3 h-3" /> PENDIENTE_X
                                                </div>
                                            ) : (
                                                <div className="text-[#1a1a2e] opacity-40 font-black flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> ARCHIVADO
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <form action={markFeedbackStatus}>
                                                <input type="hidden" name="id" value={f.id} />
                                                <input type="hidden" name="status" value={f.status === 'open' ? 'resolved' : 'open'} />
                                                <button type="submit" className="border border-[#1a1a2e] px-4 py-1 font-black text-[9px] hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all uppercase">
                                                    {f.status === 'open' ? '→ RESOLVER' : '→ REABRIR'}
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

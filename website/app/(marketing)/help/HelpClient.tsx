'use client';

import {
    Book,
    CheckCircle2,
    ChevronRight,
    LifeBuoy,
    MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function HelpClient() {
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        type: 'bug',
        subject: '',
        message: '',
        email: ''
    });

    const guides = [
        { name: 'Sincronización y Cuentas', path: '/faq#sync' },
        { name: 'IronScore y Reputación', path: '/faq#score' },
        { name: 'Compartir Rutinas', path: '/faq#share' },
        { name: 'Privacidad de Datos', path: '/privacy' }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.message.trim()) return;

        setLoading(true);
        // @ts-ignore
        if (typeof window !== 'undefined' && window.posthog) {
            // @ts-ignore
            window.posthog.capture('user_feedback', {
                message: formData.message,
                feedbackType: formData.type,
                subject: formData.subject || null,
                contactEmail: formData.email || null,
                context: 'web_help_center'
            });
        }

        await new Promise(r => setTimeout(r, 1500)); // Aesthetic loading
        setSent(true);
        setLoading(false);
        setTimeout(() => {
            setSent(false);
            setShowForm(false);
            setFormData({ type: 'bug', subject: '', message: '', email: '' });
        }, 5000);
    };

    return (
        <main className="min-h-screen bg-[#f5f1e8] text-[#1a1a2e] selection:bg-[#1a1a2e] selection:text-[#f5f1e8] py-20 lg:py-32">
            <div className="container mx-auto px-4 max-w-4xl">
                {/* Header */}
                <header className="mb-20 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 border-[2px] border-[#1a1a2e] text-[10px] font-black uppercase tracking-[0.3em] mb-6 animate-pulse">
                        <LifeBuoy className="w-3.5 h-3.5" />
                        SUPPORT_OPERATIONS_ACTIVE
                    </div>
                    <h1 className="text-6xl lg:text-8xl font-black uppercase tracking-tighter leading-none italic mb-6">
                        CENTRO_DE_AYUDA
                    </h1>
                    <p className="text-sm font-bold opacity-60 uppercase tracking-[0.4em] italic">
                        PROTOCOLOS DE TRANSMISIÓN Y SOPORTE TÉCNICO
                    </p>
                </header>

                {/* Main Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
                    <div className="border-[4px] border-[#1a1a2e] p-8 bg-white shadow-[12px_12px_0px_0px_rgba(26,26,46,0.1)] group">
                        <Book className="w-10 h-10 mb-6 opacity-20 group-hover:opacity-100 transition-opacity" />
                        <h2 className="text-2xl font-black uppercase tracking-tight mb-4 group-hover:italic transition-all">GUÍAS_RÁPIDAS</h2>
                        <ul className="space-y-3">
                            {guides.map((item) => (
                                <li key={item.name}>
                                    <Link
                                        href={item.path}
                                        className="flex items-center justify-between group/item py-1"
                                    >
                                        <span className="text-xs font-bold uppercase italic opacity-60 group-hover/item:opacity-100 transition-opacity">{item.name}</span>
                                        <ChevronRight className="w-4 h-4 opacity-0 group-hover/item:opacity-40 transition-all -translate-x-2 group-hover/item:translate-x-0" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="border-[4px] border-[#1a1a2e] p-8 bg-[#1a1a2e] text-[#f5f1e8] shadow-[12px_12px_0px_0px_rgba(26,26,46,0.1)] group transition-all duration-500 overflow-hidden">
                        <MessageSquare className="w-10 h-10 mb-6 opacity-20 group-hover:opacity-100 transition-opacity" />
                        <h2 className="text-2xl font-black uppercase tracking-tight mb-4 group-hover:italic transition-all">SOPORTE_DIRECTO</h2>

                        {!showForm && !sent ? (
                            <>
                                <p className="text-xs font-bold opacity-60 uppercase leading-loose mb-8 italic">
                                    ¿PROBLEMAS CON TU TRANSMISIÓN? NUESTROS OPERADORES ESTÁN DISPONIBLES.
                                </p>
                                <button
                                    className="w-full py-4 font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 bg-[#f5f1e8] text-[#1a1a2e] border-[#f5f1e8] hover:invert border-[2px]"
                                    onClick={() => setShowForm(true)}
                                >
                                    INICIAR_NUEVA_TRANSMISIÓN
                                </button>
                            </>
                        ) : sent ? (
                            <div className="py-10 text-center animate-in fade-in zoom-in duration-500">
                                <CheckCircle2 className="w-16 h-16 mx-auto mb-6 text-green-400" />
                                <h3 className="text-xl font-black uppercase tracking-tighter mb-2 italic">TRANSMISIÓN_ENVIADA_✓</h3>
                                <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest italic">EL PROTOCOLO DE SOPORTE HA SIDO INICIADO.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] mb-2 opacity-60">CATEGORÍA_REPORTE</label>
                                    <select
                                        className="w-full bg-white/5 border-2 border-[#f5f1e8]/20 p-3 text-[10px] font-bold uppercase focus:border-[#f5f1e8] outline-none transition-colors"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="bug" className="text-black">BUG_SISTEMA</option>
                                        <option value="feature_request" className="text-black">MEJORA_Sugerencia</option>
                                        <option value="account" className="text-black">PROBLEMA_CUENTA</option>
                                        <option value="other" className="text-black">OTRO_ASUNTO</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] mb-2 opacity-60">EMAIL_CONTACTO (OPCIONAL)</label>
                                    <input
                                        type="email"
                                        className="w-full bg-white/5 border-2 border-[#f5f1e8]/20 p-3 text-[10px] font-bold uppercase focus:border-[#f5f1e8] outline-none transition-colors"
                                        placeholder="OPERADOR@EMAIL.COM"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] mb-2 opacity-60">DETALLES_TRANSMISIÓN</label>
                                    <textarea
                                        required
                                        rows={4}
                                        className="w-full bg-white/5 border-2 border-[#f5f1e8]/20 p-3 text-[10px] font-bold uppercase focus:border-[#f5f1e8] outline-none transition-colors resize-none"
                                        placeholder="DESCRIBA EL INCIDENTE CON PRECISIÓN..."
                                        value={formData.message}
                                        onChange={e => setFormData({ ...formData, message: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="flex-1 py-3 border-2 border-[#f5f1e8]/20 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors"
                                    >
                                        CANCELAR
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || !formData.message.trim()}
                                        className="flex-[2] py-3 bg-[#f5f1e8] text-[#1a1a2e] text-[9px] font-black uppercase tracking-widest hover:invert transition-all disabled:opacity-50"
                                    >
                                        {loading ? 'ENVIANDO...' : 'ENVIAR_TICKET_PROTOCOLO'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

                {/* Footer / FAQ Reference */}
                <div className="border-t-[3px] border-[#1a1a2e] pt-12 flex flex-col md:flex-row items-center justify-between gap-8 opacity-40">
                    <div className="text-[9px] font-black uppercase tracking-[0.4em]">
                        IRON_TRAIN_VERSION_2.4.0 // STABLE_BUILD
                    </div>
                    <Link href="/faq" className="flex items-center gap-2 text-[10px] font-bold uppercase hover:opacity-100 transition-opacity">
                        CONSULTAR_FAQ <ExternalLink className="w-3 h-3" />
                    </Link>
                </div>
            </div>
        </main>
    );
}

function ExternalLink({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
    );
}

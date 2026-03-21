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

    const guides = [
        { name: 'Primeros Pasos', path: '/faq' },
        { name: 'Sincronización de Perfil', path: '/faq' },
        { name: 'Protocolos de IronScore', path: '/faq' },
        { name: 'Exportar Data', path: '/faq' }
    ];

    const handleTicket = () => {
        // @ts-ignore
        if (typeof window !== 'undefined' && window.posthog) {
            // @ts-ignore
            window.posthog.capture('support_ticket_opened');
        }
        setSent(true);
        setTimeout(() => setSent(false), 3000);
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

                    <div className="border-[4px] border-[#1a1a2e] p-8 bg-[#1a1a2e] text-[#f5f1e8] shadow-[12px_12px_0px_0px_rgba(26,26,46,0.1)] group">
                        <MessageSquare className="w-10 h-10 mb-6 opacity-20 group-hover:opacity-100 transition-opacity" />
                        <h2 className="text-2xl font-black uppercase tracking-tight mb-4 group-hover:italic transition-all">SOPORTE_DIRECTO</h2>
                        <p className="text-xs font-bold opacity-60 uppercase leading-loose mb-8 italic">
                            ¿PROBLEMAS CON TU TRANSMISIÓN? NUESTROS OPERADORES ESTÁN DISPONIBLES.
                        </p>
                        <button
                            className={`w-full py-4 font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${sent ? 'bg-green-500 text-white border-green-500' : 'bg-[#f5f1e8] text-[#1a1a2e] border-[#f5f1e8] hover:invert'
                                } border-[2px]`}
                            onClick={handleTicket}
                            disabled={sent}
                        >
                            {sent ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    TRANSMISIÓN_ENVIADA_✓
                                </>
                            ) : (
                                'INICIAR_TICKET_POSTHOG'
                            )}
                        </button>
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

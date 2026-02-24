"use client";

/**
 * Marketing Layout - RECIBO TÉRMICO THEME
 * Identidad única: MotionA Brand Identity
 */

import { Mail, MapPin, Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

interface MarketingLayoutProps {
    children: ReactNode;
}

const primaryLinks = [
    { href: "/#features", label: "Características", code: "001" },
    { href: "/#pricing", label: "Planes", code: "002" },
    { href: "/#about", label: "Sobre Nosotros", code: "003" },
];

export default function MarketingLayout({ children }: MarketingLayoutProps) {
    const currentDate = new Date().toLocaleDateString('es-AR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });

    const leftPanelContent = (
        <div className="flex flex-col h-full font-mono text-sm">
            <Link href="/" className="border-b border-[#1a1a2e]/10 pb-5 mb-6 block group hover:border-[#1a1a2e]/30 transition-colors">
                <div className="text-[10px] opacity-40 tracking-[0.2em] mb-3">[ ENTRENAMIENTO FITNESS ]</div>
                <div className="flex items-center gap-3 mb-2">
                    <Image
                        src="/icon.png"
                        alt="IronTrain"
                        width={32}
                        height={32}
                        className="w-8 h-8 opacity-85 group-hover:opacity-100 transition-opacity grayscale contrast-125"
                        priority
                    />
                    <div className="text-2xl font-bold tracking-tighter leading-none">IRONTRAIN</div>
                </div>
                <div className="text-[10px] opacity-40 font-mono">{currentDate}</div>
            </Link>

            <nav className="flex-1 space-y-1">
                <div className="text-[10px] opacity-40 mb-3">━━ NAVEGACIÓN ━━</div>
                {primaryLinks.map((item) => (
                    <Link 
                        key={item.code} 
                        href={item.href}
                        className="group flex items-center justify-between py-2 px-3 hover:bg-current/5 transition-colors border-l-2 border-transparent hover:border-current"
                    >
                        <span className="font-medium">{item.label}</span>
                        <span className="text-[10px] opacity-40 group-hover:opacity-100 transition-opacity">[{item.code}]</span>
                    </Link>
                ))}
            </nav>

            <div className="border-t border-current pt-4 mt-6 space-y-3">
                <Link
                    href="https://play.google.com/store/apps/details?id=com.irontrain"
                    className="block py-2 px-3 text-center border border-current hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all"
                >
                    → DESCARGAR APP
                </Link>
                <Link
                    href="https://apps.apple.com/app/irontrain"
                    className="block py-2 px-3 text-center bg-[#1a1a2e] text-[#f5f1e8] hover:opacity-90 transition-opacity"
                >
                    ▸ APP STORE
                </Link>
            </div>

            <div className="mt-6 pt-5 border-t border-[#1a1a2e]/10">
                <Link 
                    href="https://motiona.xyz" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 group mb-3"
                >
                    <Image
                        src="/motiona-logo.png"
                        alt="Motiona"
                        width={20}
                        height={20}
                        className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity grayscale contrast-110"
                    />
                    <div className="text-[10px] opacity-30 tracking-[0.15em] group-hover:opacity-50 transition-opacity">POWERED BY MOTIONA.XYZ</div>
                </Link>
                <div className="text-[10px] opacity-25 tracking-wide">© 2026 ALL RIGHTS RESERVED</div>
            </div>
        </div>
    );

    const rightPanelContent = (
        <div className="flex flex-col h-full font-mono text-sm">
            <div className="border-b border-current pb-4 mb-6">
                <div className="text-[10px] opacity-60 mb-2">INFO DE CONTACTO</div>
            </div>

            <div className="space-y-4 flex-1">
                <div>
                    <div className="text-[10px] opacity-40 mb-2">━━ EMAIL ━━</div>
                    <Link href="mailto:soporte@motiona.xyz" className="hover:opacity-70 transition-opacity flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>soporte@motiona.xyz</span>
                    </Link>
                </div>

                <div>
                    <div className="text-[10px] opacity-40 mb-2">━━ SOPORTE ━━</div>
                    <Link href="tel:+543434473599" className="hover:opacity-70 transition-opacity flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>+54 343 447-3599</span>
                    </Link>
                </div>

                <div>
                    <div className="text-[10px] opacity-40 mb-2">━━ UBICACIÓN ━━</div>
                    <div className="flex items-start gap-2 opacity-60">
                        <MapPin className="h-4 w-4 mt-0.5" />
                        <span>Santa Fe, Argentina</span>
                    </div>
                </div>
            </div>

            <div className="border-t border-current pt-4 mt-6">
                <div className="text-[10px] opacity-40 mb-3">━━ LEGAL ━━</div>
                <div className="space-y-2">
                    <Link href="/terms" className="block hover:opacity-70 transition-opacity">
                        Términos de Servicio
                    </Link>
                    <Link href="/privacy" className="block hover:opacity-70 transition-opacity">
                        Política de Privacidad
                    </Link>
                </div>
            </div>

            <div className="text-[10px] opacity-40 mt-6 pt-4 border-t border-current leading-relaxed">
                App móvil de entrenamiento personalizado desarrollada por MotionA.
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f5f1e8] text-[#1a1a2e] thermal-paper">
            <div className="flex">
                {/* LEFT SIDEBAR */}
                <aside className="hidden lg:flex w-64 border-r border-current/20 p-6 sticky top-0 h-screen overflow-y-auto thermal-scrollbar flex-col">
                    {leftPanelContent}
                </aside>

                {/* MAIN */}
                <main className="flex-1 min-w-0">
                    {children}
                </main>

                {/* RIGHT SIDEBAR */}
                <aside className="hidden lg:flex w-72 border-l border-current/20 p-6 sticky top-0 h-screen overflow-y-auto thermal-scrollbar flex-col">
                    {rightPanelContent}
                </aside>
            </div>

            {/* MOBILE MENU */}
            <div className="lg:hidden fixed top-0 left-0 right-0 bg-[#f5f1e8] border-b border-[#1a1a2e]/20 p-4 z-50 flex items-center justify-between font-mono">
                <div className="text-lg font-bold">IRONTRAIN</div>
                <div className="flex gap-3">
                    <Link href="https://play.google.com/store" className="text-sm border border-[#1a1a2e] px-3 py-1">ANDROID</Link>
                    <Link href="https://apps.apple.com" className="text-sm bg-[#1a1a2e] text-[#f5f1e8] px-3 py-1">iOS</Link>
                </div>
            </div>
        </div>
    );
}

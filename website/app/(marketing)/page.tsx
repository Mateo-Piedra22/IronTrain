/**
 * Landing Page - RECIBO TÉRMICO THEME
 * IronTrain - App de Entrenamiento
 */

import { ArrowRight, Calendar, Check, Dumbbell, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

function HeroSection() {
    return (
        <section className="border-b border-current/10 py-20 lg:py-32">
            <div className="max-w-4xl mx-auto px-6 font-mono">
                <div className="text-center space-y-8">
                    <div className="text-[10px] opacity-40 tracking-[0.3em]">
                        ━━━ ENTRENAMIENTO PERSONALIZADO ━━━
                    </div>
                    
                    <h1 className="text-4xl lg:text-6xl font-bold tracking-tight leading-none">
                        IRONTRAIN
                        <span className="block text-2xl lg:text-3xl mt-4 opacity-60">
                            Rutinas · Progreso · Resultados
                        </span>
                    </h1>

                    <div className="max-w-2xl mx-auto text-sm lg:text-base opacity-80 leading-relaxed">
                        App móvil de entrenamiento con rutinas personalizadas, seguimiento de progreso 
                        y conexión directa con tu gimnasio. Entrena de forma inteligente.
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
                        <Link
                            href="https://play.google.com/store/apps/details?id=com.irontrain"
                            className="group bg-[#1a1a2e] text-[#f5f1e8] px-8 py-4 font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                        >
                            DESCARGAR EN ANDROID
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link
                            href="https://apps.apple.com/app/irontrain"
                            className="border-2 border-[#1a1a2e] px-8 py-4 font-bold hover:bg-[#1a1a2e]/5 transition-colors"
                        >
                            DESCARGAR EN iOS
                        </Link>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 pt-8 text-xs opacity-60">
                        <span>✓ RUTINAS PERSONALIZADAS</span>
                        <span>━</span>
                        <span>✓ SEGUIMIENTO DE PROGRESO</span>
                        <span>━</span>
                        <span>✓ MODO OFFLINE</span>
                    </div>
                </div>
            </div>
        </section>
    );
}

function FeaturesSection() {
    const features = [
        {
            code: "F001",
            icon: Dumbbell,
            title: "Rutinas Dinámicas",
            desc: "Motor de rutinas inteligente. Adapta tu entrenamiento según tu nivel y objetivos.",
        },
        {
            code: "F002",
            icon: Calendar,
            title: "Planificación Semanal",
            desc: "Organiza tu semana de entrenamiento. Notificaciones y recordatorios incluidos.",
        },
        {
            code: "F003",
            icon: TrendingUp,
            title: "Progreso Visual",
            desc: "Gráficos de evolución, historial de cargas y métricas de rendimiento.",
        },
        {
            code: "F004",
            icon: Users,
            title: "Conexión con Gimnasio",
            desc: "Sincroniza con IronHub. Recibe rutinas de tu entrenador directamente en la app.",
        },
    ];

    return (
        <section id="features" className="py-20 lg:py-32 border-b border-current/10">
            <div className="max-w-6xl mx-auto px-6">
                <div className="text-center mb-16 font-mono">
                    <div className="text-[10px] opacity-40 tracking-[0.3em] mb-4">
                        ━━━ CARACTERÍSTICAS ━━━
                    </div>
                    <h2 className="text-3xl lg:text-5xl font-bold">
                        ENTRENA MÁS INTELIGENTE
                    </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {features.map((feature) => (
                        <div 
                            key={feature.code}
                            className="border border-current/20 p-6 hover:border-current/40 transition-all group"
                        >
                            <div className="font-mono">
                                <div className="flex items-center gap-3 mb-4">
                                    <feature.icon className="w-6 h-6 opacity-60" />
                                    <div className="text-[10px] opacity-40">[{feature.code}]</div>
                                </div>
                                <h3 className="text-lg font-bold mb-3">{feature.title}</h3>
                                <p className="text-sm opacity-70 leading-relaxed">{feature.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function PricingSection() {
    return (
        <section id="pricing" className="py-20 lg:py-32 border-b border-current/10">
            <div className="max-w-4xl mx-auto px-6 font-mono">
                <div className="text-center mb-12">
                    <div className="text-[10px] opacity-40 tracking-[0.3em] mb-4">
                        ━━━ PLANES ━━━
                    </div>
                    <h2 className="text-3xl lg:text-5xl font-bold">
                        100% GRATIS
                    </h2>
                </div>

                <div className="border-2 border-[#1a1a2e] p-8 text-center">
                    <div className="text-4xl font-bold mb-4">$0</div>
                    <div className="text-sm opacity-60 mb-6">PARA SIEMPRE</div>
                    <div className="space-y-3 text-sm mb-8">
                        <div className="flex items-center justify-center gap-2">
                            <Check className="w-4 h-4" />
                            <span>Rutinas ilimitadas</span>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                            <Check className="w-4 h-4" />
                            <span>Seguimiento completo</span>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                            <Check className="w-4 h-4" />
                            <span>Sin anuncios</span>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                            <Check className="w-4 h-4" />
                            <span>Sincronización en la nube</span>
                        </div>
                    </div>
                    <Link
                        href="https://play.google.com/store"
                        className="block bg-[#1a1a2e] text-[#f5f1e8] py-4 font-bold hover:opacity-90 transition-opacity"
                    >
                        DESCARGAR AHORA
                    </Link>
                </div>
            </div>
        </section>
    );
}

function AboutSection() {
    return (
        <section id="about" className="py-20 lg:py-32 border-b border-current/10">
            <div className="max-w-4xl mx-auto px-6 font-mono">
                <div className="text-center mb-12">
                    <div className="text-[10px] opacity-40 tracking-[0.3em] mb-4">
                        ━━━ SOBRE NOSOTROS ━━━
                    </div>
                    <h2 className="text-3xl lg:text-5xl font-bold">
                        DESARROLLADO POR MOTIONA
                    </h2>
                </div>

                <div className="space-y-6 text-sm leading-relaxed opacity-80">
                    <p>
                        IronTrain es una aplicación móvil de entrenamiento personalizado desarrollada 
                        por <strong>MotionA</strong>, con sede en Santa Fe, Argentina.
                    </p>
                    <p>
                        Diseñada para funcionar en conjunto con IronHub (plataforma de gestión de gimnasios), 
                        IronTrain permite a los usuarios recibir rutinas de sus entrenadores y hacer 
                        seguimiento de su progreso de forma simple y efectiva.
                    </p>
                    <p>
                        Disponible para Android e iOS, completamente gratis y sin anuncios.
                    </p>
                </div>

                <div className="mt-12 text-center">
                    <Link
                        href="https://motiona.xyz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 border-2 border-[#1a1a2e] px-8 py-3 font-bold hover:bg-[#1a1a2e]/5 transition-colors text-sm"
                    >
                        CONOCER MOTIONA
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </section>
    );
}

function CTASection() {
    return (
        <section className="py-20 lg:py-32">
            <div className="max-w-4xl mx-auto px-6 text-center font-mono">
                <h2 className="text-3xl lg:text-5xl font-bold mb-6">
                    LISTO PARA ENTRENAR
                </h2>
                <p className="text-sm opacity-70 mb-8 max-w-2xl mx-auto">
                    Descarga IronTrain gratis y lleva tu entrenamiento al siguiente nivel.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        href="https://play.google.com/store"
                        className="inline-flex items-center gap-3 bg-[#1a1a2e] text-[#f5f1e8] px-10 py-5 font-bold text-lg hover:opacity-90 transition-opacity"
                    >
                        ANDROID
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                    <Link
                        href="https://apps.apple.com"
                        className="inline-flex items-center gap-3 bg-[#1a1a2e] text-[#f5f1e8] px-10 py-5 font-bold text-lg hover:opacity-90 transition-opacity"
                    >
                        iOS
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </div>
        </section>
    );
}

export default function LandingPage() {
    return (
        <>
            <HeroSection />
            <FeaturesSection />
            <PricingSection />
            <AboutSection />
            <CTASection />
        </>
    );
}

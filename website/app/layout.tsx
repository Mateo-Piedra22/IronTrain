import { NeonAuthUIProvider } from '@neondatabase/auth/react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { PHProvider } from '../src/components/PostHogProvider';
import { authClient } from '../src/lib/auth/client';
import { auth } from '../src/lib/auth/server';
import MaintenanceGuard from './components/MaintenanceGuard';
import './globals.css';

export const metadata: Metadata = {
    title: {
        default: 'IronTrain - App de Entrenamiento Personalizado con Rutinas Inteligentes',
        template: '%s | IronTrain'
    },
    description: 'App móvil de entrenamiento con rutinas personalizadas basadas en IA, seguimiento de progreso en tiempo real, planes adaptados a tu nivel y estadísticas detalladas. Transforma tu físico con tecnología inteligente. Desarrollado por MotionA.',
    keywords: [
        'app entrenamiento',
        'fitness app',
        'rutinas gimnasio',
        'entrenamiento personalizado',
        'app gym',
        'seguimiento progreso fitness',
        'rutinas inteligentes',
        'workout app',
        'entrenador personal app',
        'ejercicios gimnasio',
        'plan entrenamiento',
        'fitness tracker',
        'app musculación',
        'rutinas gym personalizadas',
        'entrenamiento IA',
        'fitness argentina',
        'app fitness gratis',
        'training app'
    ],
    applicationName: 'IronTrain',
    creator: 'Mateo Piedrabuena',
    publisher: 'MotionA',
    authors: [{ name: 'MotionA', url: 'https://motiona.xyz' }],
    category: 'health',
    icons: {
        icon: [{ url: '/icon.png', type: 'image/png' }],
        apple: [{ url: '/icon.png', sizes: '180x180', type: 'image/png' }]
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'IronTrain'
    },
    metadataBase: new URL('https://irontrain.motiona.xyz'),
    openGraph: {
        type: 'website',
        locale: 'es_AR',
        siteName: 'IronTrain',
        title: 'IronTrain - App de Entrenamiento Personalizado',
        description: 'App móvil de entrenamiento con rutinas personalizadas, seguimiento de progreso y planes adaptados a tu nivel.',
        url: 'https://irontrain.motiona.xyz',
        images: [{
            url: '/og-image.png',
            width: 1200,
            height: 630,
            alt: 'IronTrain - App de Entrenamiento'
        }]
    },
    twitter: {
        card: 'summary_large_image',
        title: 'IronTrain - Entrenamiento Personalizado',
        description: 'App móvil de entrenamiento con rutinas inteligentes y seguimiento de progreso.',
        images: ['/og-image.png']
    },
    robots: {
        index: true,
        follow: true
    }
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // 1. System Status Fetch
    const { getSystemStatus } = await import('../src/lib/system-status');
    const status = await getSystemStatus();

    // 2. Path Detection (via middleware injected header)
    const headerList = await headers();
    const fullUrl = headerList.get('x-url') || '';
    const isMaintenance = status.maintenanceMode === 1;
    const isAdminPath = fullUrl.includes('/admin') || fullUrl.includes('/auth');
    const isOfflineOnly = status.offlineOnlyMode === 1;
    const hideBanners = isAdminPath;

    // 3. User Session for Analytics
    const { data: sessionData } = await auth.getSession();
    const user = sessionData?.user;

    return (
        <html lang="es">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            </head>
            <body className="min-h-screen antialiased bg-[#fff7f1]" data-brand="irontrain">
                <PHProvider userId={user?.id} userEmail={user?.email}>
                    <NeonAuthUIProvider authClient={authClient as any} redirectTo="/auth/bridge" emailOTP>
                        <MaintenanceGuard>
                            {!hideBanners && isMaintenance && (
                                <div className="bg-red-600 text-white py-3 px-6 text-center text-xs font-black uppercase tracking-[0.2em] sticky top-0 z-[100] shadow-lg flex items-center justify-center gap-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                                    <span>Modo Mantenimiento Activo — {status.message || 'Algunas funciones pueden estar limitadas.'}</span>
                                </div>
                            )}
                            {!hideBanners && !isMaintenance && isOfflineOnly && (
                                <div className="bg-[#1a1a2e] text-[#f5f1e8] py-3 px-6 text-center text-xs font-black uppercase tracking-[0.2em] sticky top-0 z-[100] shadow-md flex items-center justify-center gap-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" /></svg>
                                    <span>Modo 100% Offline — Sincronización deshabilitada temporalmente</span>
                                </div>
                            )}
                            {children}
                        </MaintenanceGuard>
                    </NeonAuthUIProvider>
                </PHProvider>
            </body>
        </html>
    );
}

import { NeonAuthUIProvider } from '@neondatabase/auth/react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { PHProvider } from '../src/components/PostHogProvider';
import { authClient } from '../src/lib/auth/client';
import { auth } from '../src/lib/auth/server';
import MaintenanceGuard from './components/MaintenanceGuard';
import './globals.css';

export const dynamic = 'force-dynamic';

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
    // 1. User Session for Analytics
    const { data: sessionData } = await auth.getSession();

    console.log(`[RootLayout] SSR Session found: ${!!sessionData?.session}`);
    if (!sessionData?.session) {
        const cookiesList = (await cookies()).getAll();
        console.log(`[RootLayout] Cookies count: ${cookiesList.length}`);
    }

    const user = sessionData?.user;

    return (
        <html lang="es">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            </head>
            <body className="min-h-screen antialiased bg-[#fff7f1]" data-brand="irontrain">
                <PHProvider userId={user?.id} userEmail={user?.email}>
                    {/* @ts-ignore */}
                    <NeonAuthUIProvider authClient={authClient as any} initialSession={sessionData} redirectTo="/auth/bridge" emailOTP>
                        <MaintenanceGuard>
                            {children}
                        </MaintenanceGuard>
                    </NeonAuthUIProvider>
                </PHProvider>
            </body>
        </html>
    );
}

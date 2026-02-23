import type { Metadata } from 'next';
import MarketingLayout from './(marketing)/layout';
import './globals.css';

export const metadata: Metadata = {
    title: 'IronTrain | App de Entrenamiento Personalizado',
    description: 'App móvil de entrenamiento con rutinas personalizadas y seguimiento de progreso. Desarrollado por MotionA.',
    keywords: ['fitness app', 'entrenamiento', 'IronTrain', 'MotionA', 'rutinas gym'],
    authors: [{ name: 'MotionA' }],
    creator: 'MotionA',
    publisher: 'MotionA',
    metadataBase: new URL('https://irontrain.motiona.xyz'),
    alternates: {
        canonical: '/',
    },
    openGraph: {
        title: 'IronTrain | App de Entrenamiento Personalizado',
        description: 'App móvil de entrenamiento desarrollada por MotionA.',
        url: 'https://irontrain.motiona.xyz',
        siteName: 'IronTrain',
        locale: 'es_AR',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'IronTrain | Entrenamiento Personalizado',
        description: 'App móvil de entrenamiento desarrollada por MotionA.',
    },
    robots: {
        index: true,
        follow: true,
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            </head>
            <body className="min-h-screen antialiased" data-brand="irontrain">
                <MarketingLayout>
                    {children}
                </MarketingLayout>
            </body>
        </html>
    );
}

import type { Metadata } from 'next';
import { Footer } from '../src/components/Footer';
import { Nav } from '../src/components/Nav';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://irontrain.motiona.xyz'),
  title: {
    default: 'IronTrain',
    template: '%s · IronTrain',
  },
  description: 'Entrena, registra y analiza tu progreso con una experiencia rápida y cuidada.',
  openGraph: {
    title: 'IronTrain',
    description: 'Entrena, registra y analiza tu progreso con una experiencia rápida y cuidada.',
    url: 'https://irontrain.motiona.xyz',
    siteName: 'IronTrain',
    locale: 'es_ES',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 py-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

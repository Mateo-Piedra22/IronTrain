import type { Metadata } from 'next';
import { Footer } from '../src/components/Footer';
import { Nav } from '../src/components/Nav';
import '../src/motiona-design-system/styles/base.css';
import '../src/motiona-design-system/styles/components.css';
import '../src/motiona-design-system/styles/layouts.css';
import '../src/motiona-design-system/styles/utilities.css';
import './globals.css';

export const metadata: Metadata = {
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
      <body className="min-h-screen" data-brand="irontrain">
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 py-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

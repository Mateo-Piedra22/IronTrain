'use client';

import { useAuthData } from '@neondatabase/auth/react';
import { Shield, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { authClient } from '../lib/auth/client';

const links = [
  { href: '/feed', label: 'Feed Social' },
  { href: '/downloads', label: 'Descargas' },
  { href: '/changelog', label: 'Novedades' },
  { href: '/faq', label: 'FAQ' },
  { href: '/support', label: 'Soporte' },
  { href: '/donate', label: 'Donar' },
];

export function Nav() {
  const { data: session, isPending: loading } = useAuthData(authClient as any);
  const pathname = usePathname();

  // Admin check (simple UI check, server-side still validates)
  // We can't easily check env in client, but we can check if it's an admin path
  // or use user metadata if available in session.
  const isAdmin = pathname.startsWith('/admin') || (session as any)?.user?.isAdmin;

  return (
    <header className="sticky top-0 z-50 border-b border-iron-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-3 transition-transform hover:scale-105">
          <img
            src="/icon.png"
            alt="IronTrain"
            width={36}
            height={36}
            className="h-9 w-9 rounded-xl border border-iron-200 bg-white shadow-sm"
          />
          <div className="font-black text-slate-900 tracking-tighter text-xl">IronTrain</div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-bold text-slate-700 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`transition-colors hover:text-iron-600 ${pathname === l.href ? 'text-iron-600 underline underline-offset-4' : ''
                }`}
            >
              {l.label}
            </Link>
          ))}
          {session && (
            <Link
              href="/admin"
              className={`flex items-center gap-1.5 transition-colors hover:text-red-600 ${pathname === '/admin' ? 'text-red-600 underline underline-offset-4' : ''
                }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {!loading && (
            <>
              {session ? (
                <Link
                  href="/auth/sign-out"
                  className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <User className="w-4 h-4" />
                  Salir
                </Link>
              ) : (
                <Link
                  href="/auth/sign-in"
                  className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Entrar
                </Link>
              )}
            </>
          )}

          <Link
            href="/downloads"
            className="rounded-xl bg-[#1a1a2e] px-5 py-2.5 text-sm font-black text-white hover:bg-black transition-all shadow-md active:scale-95"
          >
            Descargar
          </Link>
        </div>
      </div>
    </header>
  );
}

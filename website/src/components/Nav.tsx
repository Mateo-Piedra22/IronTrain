'use client';

import { useAuthData } from '@neondatabase/auth/react';
import { LogIn, LogOut, Shield, User, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { authClient } from '../lib/auth/client';

const links = [
  { href: '/feed', label: 'Feed Social' },
  { href: '/downloads', label: 'Descargas' },
  { href: '/changelog', label: 'Novedades' },
  { href: '/faq', label: 'FAQ' },
  { href: '/help', label: 'Ayuda' },
  { href: '/donate', label: 'Donar' },
];

export function Nav() {
  const { data: session, isPending: loading } = useAuthData(authClient as any);
  const pathname = usePathname();

  const user = (session as any)?.user;
  const isAdmin = pathname.startsWith('/admin') || user?.isAdmin;

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

        {/* Desktop Links */}
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
          {session && isAdmin && (
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

        <div className="flex items-center gap-2 md:gap-4">
          {!loading ? (
            <>
              {session ? (
                <div className="flex items-center gap-2 md:gap-4">
                  {/* User Profile Info */}
                  <Link
                    href={`/@${user?.username || ''}`}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-full bg-iron-100 border border-iron-200 flex items-center justify-center overflow-hidden">
                      {user?.image ? (
                        <img src={user.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-iron-600" />
                      )}
                    </div>
                    <div className="hidden sm:block text-left">
                      <div className="text-xs font-black text-slate-900 leading-none">
                        {user?.name || user?.displayName || 'Usuario'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Ver Perfil
                      </div>
                    </div>
                  </Link>

                  {/* Logout Button */}
                  <Link
                    href="/auth/sign-out"
                    title="Cerrar Sesión"
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <LogOut className="w-5 h-5 md:w-4 md:h-4" />
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-1 md:gap-2">
                  <Link
                    href="/auth/sign-up"
                    className="flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    <UserPlus className="w-4 h-4 md:hidden" />
                    <span className="hidden md:inline">Registrarse</span>
                  </Link>
                  <Link
                    href="/auth/sign-in"
                    className="flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-black text-white bg-iron-600 rounded-xl hover:bg-iron-700 transition-all shadow-sm active:scale-95"
                  >
                    <LogIn className="w-4 h-4 md:hidden" />
                    <span className="hidden md:inline">Iniciar Sesión</span>
                    <span className="md:hidden">Entrar</span>
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="w-20 h-8 bg-slate-100 animate-pulse rounded-xl" />
          )}

          <Link
            href="/downloads"
            className="hidden sm:block rounded-xl bg-[#1a1a2e] px-5 py-2.5 text-sm font-black text-white hover:bg-black transition-all shadow-md active:scale-95"
          >
            Descargar
          </Link>
        </div>
      </div>
    </header>
  );
}

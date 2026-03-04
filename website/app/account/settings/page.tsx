import { eq } from 'drizzle-orm';
import { Check, ExternalLink, User } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';

export const revalidate = 0;

async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('__session')?.value || cookieStore.get('session')?.value;
    if (!token) return null;

    try {
        const jose = await import('jose');
        const secretStr = process.env.NEON_AUTH_COOKIE_SECRET;
        if (!secretStr) return null;
        const secret = new TextEncoder().encode(secretStr);
        const { payload } = await jose.jwtVerify(token, secret);
        return {
            id: (payload.sub || payload.id) as string,
            email: payload.email as string,
            token
        };
    } catch {
        return null;
    }
}

export default async function AuthBridgePage() {
    const session = await getSession();
    if (!session) {
        redirect('/auth/sign-in');
    }

    const cookieStore = await cookies();
    const redirectUri = cookieStore.get('redirect_uri')?.value;

    const profileResult = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, session.id));
    if (profileResult.length === 0) {
        await db.insert(schema.userProfiles).values({
            id: session.id,
            displayName: 'Atleta Iron',
            isPublic: 1,
            updatedAt: new Date(),
        }).onConflictDoNothing();
    }

    if (redirectUri) {
        cookieStore.delete('redirect_uri');
        const appUrl = `${redirectUri}${redirectUri.includes('?') ? '&' : '?'}token=${session.token}`;

        return (
            <div className="min-h-screen bg-[#f5f1e8] flex flex-col items-center justify-center p-6 font-mono text-[#1a1a2e]">
                <div className="w-full max-w-sm text-center space-y-10">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full animate-pulse"></div>
                        <div className="relative bg-[#1a1a2e] p-5 rounded-[2.5rem] shadow-2xl">
                            <Check className="w-12 h-12 text-white" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h1 className="text-4xl font-black tracking-tighter uppercase italic">¡Acceso Concedido!</h1>
                        <p className="text-sm opacity-50 max-w-[280px] mx-auto leading-relaxed">
                            Tu identidad ha sido verificada. Volviendo a la terminal de IronTrain...
                        </p>
                    </div>

                    <div className="space-y-4 pt-4">
                        <a
                            href={appUrl}
                            className="block w-full bg-[#1a1a2e] text-white py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-black transition-all shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center justify-center gap-3 active:scale-95 group"
                        >
                            Abrir Aplicación
                            <ExternalLink className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </a>

                        <p className="text-[10px] opacity-30 uppercase tracking-widest">
                            Si no redirige automáticamente, toca el botón arriba
                        </p>
                    </div>

                    <script dangerouslySetInnerHTML={{ __html: `setTimeout(() => { window.location.href = "${appUrl}"; }, 1000);` }} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f1e8] flex flex-col items-center justify-center p-8 font-mono text-[#1a1a2e]">
            <div className="max-w-md w-full bg-white border border-[#1a1a2e]/10 p-10 rounded-[2rem] shadow-sm text-center space-y-8">
                <div className="mx-auto w-20 h-20 bg-iron-100 rounded-full flex items-center justify-center">
                    <User className="w-10 h-10 text-iron-600" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-black tracking-tight">{profileResult[0]?.displayName || 'Atleta Logueado'}</h2>
                    <p className="text-xs opacity-40 uppercase tracking-widest">IronTrain ID: {session.id.slice(0, 8)}...</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="p-4 bg-[#f5f1e8] rounded-xl text-left">
                        <div className="text-[9px] opacity-40 font-black uppercase mb-1">Status</div>
                        <div className="text-xs font-bold text-green-600 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Conectado
                        </div>
                    </div>
                    <div className="p-4 bg-[#f5f1e8] rounded-xl text-left">
                        <div className="text-[9px] opacity-40 font-black uppercase mb-1">Sync</div>
                        <div className="text-xs font-bold text-iron-600">Cloud Ready</div>
                    </div>
                </div>

                <div className="pt-6 space-y-3">
                    <Link href="/auth/sign-out" className="block text-xs font-black uppercase text-red-600 hover:opacity-70 transition-opacity tracking-widest">
                        Cerrar Sesión
                    </Link>
                </div>
            </div>

            <footer className="mt-12 text-[10px] opacity-20 uppercase tracking-[0.5em]">
                IronHub Authentication Bridge
            </footer>
        </div>
    );
}

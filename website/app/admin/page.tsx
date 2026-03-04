import { desc, eq } from 'drizzle-orm';
import * as jose from 'jose';
import { CheckCircle, EyeOff, Shield, Trash2 } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '../../src/db';
import * as schema from '../../src/db/schema';

export const revalidate = 0;

// Hardcoded Admin Users (move to env in production: ADMIN_USER_IDS)
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean);

async function getAuthenticatedAdmin(): Promise<string | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('__session')?.value || cookieStore.get('session')?.value;
    if (!token) return null;

    try {
        const secretStr = process.env.NEON_AUTH_COOKIE_SECRET;
        if (!secretStr) return null;

        const secret = new TextEncoder().encode(secretStr);
        const { payload } = await jose.jwtVerify(token, secret);
        const userId = (payload.sub || payload.id) as string | undefined;

        if (!userId || !ADMIN_USER_IDS.includes(userId)) return null;
        return userId;
    } catch {
        return null;
    }
}

async function moderateRoutine(formData: FormData) {
    'use server';

    const adminId = await getAuthenticatedAdmin();
    if (!adminId) {
        throw new Error('Unauthorized: admin access required');
    }

    const action = formData.get('action');
    const id = formData.get('id') as string;

    if (!id || typeof id !== 'string') return;

    if (action === 'hide') {
        await db.update(schema.routines).set({ isPublic: 0 }).where(eq(schema.routines.id, id));
    } else if (action === 'delete') {
        await db.update(schema.routines).set({ deletedAt: new Date() }).where(eq(schema.routines.id, id));
    }

    revalidatePath('/admin');
    revalidatePath('/feed');
}

export default async function AdminPanel() {
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) {
        redirect('/');
    }

    const allPublicRoutines = await db.select()
        .from(schema.routines)
        .where(eq(schema.routines.isPublic, 1))
        .orderBy(desc(schema.routines.updatedAt));

    return (
        <div className="min-h-screen bg-[#f5f1e8] text-[#1a1a2e] font-mono p-8">
            <header className="flex items-center gap-4 mb-12 border-b border-[#1a1a2e]/20 pb-6">
                <Shield className="w-10 h-10 text-red-600" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Admin | Moderación</h1>
                    <p className="opacity-60 text-sm">Panel de control de contenido P2P Público</p>
                </div>
            </header>

            <div className="bg-white border border-[#1a1a2e]/20 p-6 shadow-sm">
                <h2 className="text-xl font-bold mb-6 flex justify-between items-center">
                    <span>Rutinas Públicas Activas</span>
                    <span className="text-sm bg-[#1a1a2e] text-[#f5f1e8] px-3 py-1 rounded-full">{allPublicRoutines.length}</span>
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="border-b-2 border-[#1a1a2e] opacity-70">
                                <th className="p-3">ID / Nombre</th>
                                <th className="p-3">Usuario (Autor)</th>
                                <th className="p-3">Descripción</th>
                                <th className="p-3">Estado</th>
                                <th className="p-3">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allPublicRoutines.map(r => (
                                <tr key={r.id} className="border-b border-[#1a1a2e]/10 hover:bg-[#1a1a2e]/5 transition-colors">
                                    <td className="p-3">
                                        <div className="font-bold truncate max-w-[200px]">{r.name}</div>
                                        <div className="text-[10px] opacity-40 uppercase tracking-widest">{r.id.split('-')[0]}...</div>
                                    </td>
                                    <td className="p-3 truncate max-w-[150px] opacity-80" title={r.userId}>{r.userId}</td>
                                    <td className="p-3 truncate max-w-[200px] opacity-60">{r.description || 'Sin descripción'}</td>
                                    <td className="p-3">
                                        {r.deletedAt ? (
                                            <span className="text-red-500 font-bold text-xs uppercase flex items-center gap-1"><Trash2 className="w-3 h-3" /> Eliminada</span>
                                        ) : r.isPublic === 1 ? (
                                            <span className="text-green-600 font-bold text-xs uppercase flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Pública</span>
                                        ) : (
                                            <span className="text-orange-500 font-bold text-xs uppercase flex items-center gap-1"><EyeOff className="w-3 h-3" /> Oculta</span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <form action={moderateRoutine} className="flex gap-2">
                                            <input type="hidden" name="id" value={r.id} />
                                            {r.isPublic === 1 && !r.deletedAt && (
                                                <button type="submit" name="action" value="hide" className="p-2 border border-orange-500 text-orange-600 hover:bg-orange-50 transition-colors" title="Ocultar del Feed">
                                                    <EyeOff className="w-4 h-4" />
                                                </button>
                                            )}
                                            {!r.deletedAt && (
                                                <button type="submit" name="action" value="delete" className="p-2 border border-red-500 text-red-600 hover:bg-red-50 transition-colors" title="Eliminar (Soft Delete)">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </form>
                                    </td>
                                </tr>
                            ))}
                            {allPublicRoutines.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center opacity-50 italic">
                                        No hay rutinas públicas activas en el sistema.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-8 text-xs opacity-40 text-center uppercase tracking-widest">
                IronHub &bull; Zero Trust Moderation Engine
            </div>
        </div>
    );
}

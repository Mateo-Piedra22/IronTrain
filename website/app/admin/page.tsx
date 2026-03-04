import { desc, eq, sql } from 'drizzle-orm';
import { Activity, Bug, CheckCircle, EyeOff, LayoutDashboard, Lightbulb, MessageSquareQuote, Shield, Smartphone, Trash2, Users } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../../src/db';
import * as schema from '../../src/db/schema';
import { auth } from '../../src/lib/auth/server';

export const revalidate = 0;

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);

async function getAuthenticatedAdmin(): Promise<string | null> {
    try {
        const { data: session } = await auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return null;
        if (ADMIN_USER_IDS.length === 0) return null;
        if (ADMIN_USER_IDS.includes(userId)) return userId;
        return null;
    } catch {
        return null;
    }
}

async function moderateRoutine(formData: FormData) {
    'use server';
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');
    const action = formData.get('action');
    const id = formData.get('id') as string;
    if (!id) return;
    if (action === 'hide') await db.update(schema.routines).set({ isPublic: 0 }).where(eq(schema.routines.id, id));
    else if (action === 'delete') await db.update(schema.routines).set({ deletedAt: new Date() }).where(eq(schema.routines.id, id));
    revalidatePath('/admin');
    revalidatePath('/feed');
}

async function markFeedbackStatus(formData: FormData) {
    'use server';
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');
    const id = formData.get('id') as string;
    const status = formData.get('status') as string;
    if (!id || !status) return;
    await db.update(schema.feedback).set({ status, updatedAt: new Date() }).where(eq(schema.feedback.id, id));
    revalidatePath('/admin');
}

export default async function AdminPanel() {
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) redirect('/');

    // 1. Fetch Metrics Data in parallel
    const [
        routinesData,
        profilesData,
        installsData,
        feedbackData
    ] = await Promise.all([
        db.select().from(schema.routines).where(eq(schema.routines.isPublic, 1)).orderBy(desc(schema.routines.updatedAt)),
        db.select({ count: sql<number>`count(*)` }).from(schema.userProfiles),
        db.select({ count: sql<number>`count(*)` }).from(schema.appInstalls),
        db.select().from(schema.feedback).orderBy(desc(schema.feedback.createdAt)),
    ]);

    const totalUsers = profilesData[0]?.count || 0;
    const totalInstalls = installsData[0]?.count || 0;
    const pendingFeedbackCount = feedbackData.filter(f => f.status === 'open').length;

    return (
        <div className="min-h-screen bg-[#f5f1e8] text-[#1a1a2e] font-mono p-4 md:p-8 selection:bg-red-200">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12 border-b-2 border-[#1a1a2e]/20 pb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-[#1a1a2e] p-3 rounded-xl shadow-[4px_4px_0px_#cc0000]">
                        <Shield className="w-8 h-8 text-[#f5f1e8]" />
                    </div>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tighter uppercase uppercase">Comando Central</h1>
                        <p className="opacity-60 text-sm font-semibold tracking-wider">Zero Trust Engine • Activo</p>
                    </div>
                </div>
            </header>

            {/* METRICS ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div className="bg-white border-2 border-[#1a1a2e]/20 p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform shadow-[4px_4px_0px_rgba(26,26,46,0.1)]">
                    <div className="opacity-50 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Smartphone className="w-4 h-4" /> Instalaciones
                    </div>
                    <div className="text-4xl font-black">{totalInstalls}</div>
                    <div className="text-xs opacity-50 mt-2">Dispositivos Únicos App</div>
                </div>

                <div className="bg-white border-2 border-[#1a1a2e]/20 p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform shadow-[4px_4px_0px_rgba(26,26,46,0.1)]">
                    <div className="opacity-50 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Cuentas
                    </div>
                    <div className="text-4xl font-black">{totalUsers}</div>
                    <div className="text-xs opacity-50 mt-2">Usuarios P2P Sync</div>
                </div>

                <div className="bg-white border-2 border-[#1a1a2e]/20 p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform shadow-[4px_4px_0px_rgba(26,26,46,0.1)]">
                    <div className="opacity-50 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Rutinas Públicas
                    </div>
                    <div className="text-4xl font-black">{routinesData.length}</div>
                    <div className="text-xs opacity-50 mt-2">Indexadas en Feed</div>
                </div>

                <div className="bg-[#1a1a2e] text-[#f5f1e8] border-2 border-[#1a1a2e] p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform shadow-[4px_4px_0px_#cc0000]">
                    <div className="opacity-70 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <LayoutDashboard className="w-4 h-4" /> Feedback Pendiente
                    </div>
                    <div className="text-4xl font-black text-red-500">{pendingFeedbackCount}</div>
                    <div className="text-xs opacity-70 mt-2 text-red-200">Requiere Atención</div>
                </div>
            </div>

            {/* FEEDBACK MODULE */}
            <div className="mb-12">
                <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-4">
                    <span className="bg-red-500 text-white p-1">1</span>
                    Feedback y Reportes de Usuarios
                </h2>
                <div className="bg-white border-2 border-[#1a1a2e]/20 shadow-[4px_4px_0px_rgba(26,26,46,0.1)]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono text-sm border-collapse">
                            <thead>
                                <tr className="bg-[#1a1a2e]/5 border-b-2 border-[#1a1a2e]/20">
                                    <th className="p-4 font-bold tracking-wider text-xs uppercase opacity-60">Tipo</th>
                                    <th className="p-4 font-bold tracking-wider text-xs uppercase opacity-60">Mensaje</th>
                                    <th className="p-4 font-bold tracking-wider text-xs uppercase opacity-60">Estado</th>
                                    <th className="p-4 font-bold tracking-wider text-xs uppercase opacity-60">Fecha & Meta</th>
                                    <th className="p-4 font-bold tracking-wider text-xs uppercase opacity-60">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {feedbackData.map(f => (
                                    <tr key={f.id} className="border-b border-[#1a1a2e]/10 hover:bg-[#1a1a2e]/5 transition-colors">
                                        <td className="p-4">
                                            {f.type === 'bug' && <span className="bg-red-100 text-red-800 px-2 py-1 flex items-center gap-2 font-bold w-max"><Bug className="w-3 h-3" /> Bug</span>}
                                            {f.type === 'feature_request' && <span className="bg-orange-100 text-orange-800 px-2 py-1 flex items-center gap-2 font-bold w-max"><Lightbulb className="w-3 h-3" /> Mejora</span>}
                                            {f.type === 'review' && <span className="bg-blue-100 text-blue-800 px-2 py-1 flex items-center gap-2 font-bold w-max"><MessageSquareQuote className="w-3 h-3" /> Review</span>}
                                        </td>
                                        <td className="p-4 max-w-sm">
                                            <p className="font-semibold leading-relaxed">{f.message}</p>
                                        </td>
                                        <td className="p-4">
                                            {f.status === 'open' && <span className="text-red-600 font-bold animate-pulse">PENDIENTE</span>}
                                            {f.status === 'resolved' && <span className="text-green-600 font-bold opacity-50">RESUELTO</span>}
                                            {f.status === 'closed' && <span className="text-gray-500 font-bold opacity-50">ARCHIVADO</span>}
                                            {f.userId && <p className="text-[10px] opacity-40 mt-1 uppercase truncate max-w-[100px]" title={f.userId}>USER:{f.userId}</p>}
                                        </td>
                                        <td className="p-4 text-xs opacity-60">
                                            {new Date(f.createdAt).toLocaleDateString()}<br />
                                            {f.metadata && (
                                                <pre className="text-[10px] mt-2 bg-[#1a1a2e]/5 p-2 rounded overflow-x-auto max-w-[150px]">
                                                    {JSON.stringify(JSON.parse(f.metadata || '{}'), null, 1)}
                                                </pre>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <form action={markFeedbackStatus} className="flex gap-2">
                                                <input type="hidden" name="id" value={f.id} />
                                                {f.status === 'open' ? (
                                                    <button type="submit" name="status" value="resolved" className="bg-[#1a1a2e] text-[#f5f1e8] px-3 py-2 text-xs font-bold hover:bg-green-600 transition-colors uppercase flex items-center gap-2">
                                                        <CheckCircle className="w-3 h-3" /> Resolver
                                                    </button>
                                                ) : (
                                                    <button type="submit" name="status" value="open" className="bg-orange-100 text-orange-800 border border-orange-200 px-3 py-2 text-xs font-bold hover:bg-orange-200 transition-colors uppercase">
                                                        Reabrir
                                                    </button>
                                                )}
                                            </form>
                                        </td>
                                    </tr>
                                ))}
                                {feedbackData.length === 0 && (
                                    <tr><td colSpan={5} className="p-8 text-center opacity-40 italic">La bandeja de feedback está vacía.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ROUTINES MODULE */}
            <div className="mb-12">
                <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-4">
                    <span className="bg-[#1a1a2e] text-white p-1">2</span>
                    Moderación de Feed Público
                </h2>
                <div className="bg-white border-2 border-[#1a1a2e]/20 shadow-[4px_4px_0px_rgba(26,26,46,0.1)]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono text-sm border-collapse">
                            <thead>
                                <tr className="bg-[#1a1a2e]/5 border-b-2 border-[#1a1a2e]/20">
                                    <th className="p-4 font-bold tracking-wider text-xs uppercase opacity-60">ID / Nombre</th>
                                    <th className="p-4 font-bold tracking-wider text-xs uppercase opacity-60">Usuario (Autor)</th>
                                    <th className="p-4 font-bold tracking-wider text-xs uppercase opacity-60">Descripción</th>
                                    <th className="p-4 font-bold tracking-wider text-xs uppercase opacity-60">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {routinesData.map(r => (
                                    <tr key={r.id} className="border-b border-[#1a1a2e]/10 hover:bg-[#1a1a2e]/5 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold truncate max-w-[200px] text-lg">{r.name}</div>
                                            <div className="text-[10px] opacity-40 uppercase tracking-widest">{r.id.split('-')[0]}...</div>
                                        </td>
                                        <td className="p-4 truncate max-w-[150px] opacity-80 text-xs" title={r.userId}>{r.userId}</td>
                                        <td className="p-4 truncate max-w-[250px] opacity-60 italic">{r.description || 'Sin descripción'}</td>
                                        <td className="p-4">
                                            <form action={moderateRoutine} className="flex gap-2">
                                                <input type="hidden" name="id" value={r.id} />
                                                <button type="submit" name="action" value="hide" className="flex items-center gap-2 p-2 px-3 border-2 border-orange-500 text-orange-600 hover:bg-orange-50 transition-colors uppercase text-xs font-bold" title="Ocultar del Feed">
                                                    <EyeOff className="w-4 h-4" /> Bajar
                                                </button>
                                                <button type="submit" name="action" value="delete" className="flex items-center gap-2 p-2 px-3 border-2 border-red-500 text-red-600 hover:bg-red-50 transition-colors uppercase text-xs font-bold" title="Eliminar (Soft Delete)">
                                                    <Trash2 className="w-4 h-4" /> Purga
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                ))}
                                {routinesData.length === 0 && (
                                    <tr><td colSpan={4} className="p-8 text-center opacity-40 italic">No hay rutinas públicas activas en el sistema para moderar.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="mt-16 text-[10px] opacity-30 text-center uppercase tracking-widest font-bold pb-8">
                IronTrain &bull; Enterprise Zero Trust Telemetry & Moderation Engine &bull; System Active
            </div>
        </div>
    );
}

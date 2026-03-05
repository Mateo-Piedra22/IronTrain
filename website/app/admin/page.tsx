import { desc, eq, isNull, sql } from 'drizzle-orm';
import { Activity, CheckCircle, EyeOff, LayoutDashboard, Shield, Smartphone, Trash2, Users } from 'lucide-react';
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
        db.select({
            id: schema.routines.id,
            name: schema.routines.name,
            description: schema.routines.description,
            isPublic: schema.routines.isPublic,
            updatedAt: schema.routines.updatedAt,
            userId: schema.routines.userId,
            username: schema.userProfiles.username,
        })
            .from(schema.routines)
            .leftJoin(schema.userProfiles, eq(schema.routines.userId, schema.userProfiles.id))
            .where(isNull(schema.routines.deletedAt))
            .orderBy(desc(schema.routines.updatedAt)),
        db.select({ count: sql<number>`count(*)` }).from(schema.userProfiles),
        db.select({ count: sql<number>`count(*)` }).from(schema.appInstalls),
        db.select().from(schema.feedback).orderBy(desc(schema.feedback.createdAt)),
    ]);

    const totalUsers = profilesData[0]?.count || 0;
    const totalInstalls = installsData[0]?.count || 0;
    const pendingFeedbackCount = feedbackData.filter(f => f.status === 'open').length;

    return (
        <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans p-4 md:p-8 selection:bg-orange-100">
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12 border-b-2 border-slate-200 pb-8 text-left">
                <div className="flex items-center gap-4">
                    <div className="bg-orange-500 p-3 rounded-2xl shadow-lg shadow-orange-500/20 text-left">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-left">
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 uppercase">Comando Central</h1>
                        <p className="text-slate-500 text-sm font-bold tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Zero Trust Engine • Activo
                        </p>
                    </div>
                </div>
            </header>

            {/* METRICS ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 text-left">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-left">
                        <Smartphone className="w-4 h-4 text-orange-500" /> Instalaciones
                    </div>
                    <div className="text-4xl font-black text-slate-900">{totalInstalls}</div>
                    <div className="text-[10px] text-slate-400 font-bold mt-2 uppercase">Dispositivos Únicos</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-left">
                        <Users className="w-4 h-4 text-blue-500" /> Cuentas
                    </div>
                    <div className="text-4xl font-black text-slate-900">{totalUsers}</div>
                    <div className="text-[10px] text-slate-400 font-bold mt-2 uppercase">Usuarios P2P Sync</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-left">
                        <Activity className="w-4 h-4 text-green-500" /> Públicas
                    </div>
                    <div className="text-4xl font-black text-slate-900">{routinesData.filter(r => r.isPublic === 1).length}</div>
                    <div className="text-[10px] text-slate-400 font-bold mt-2 uppercase">Indexadas en Feed</div>
                </div>

                <div className="bg-slate-900 rounded-3xl p-6 shadow-xl shadow-slate-900/20 flex flex-col justify-between text-left">
                    <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-left">
                        <LayoutDashboard className="w-4 h-4 text-red-500" /> Pendiente
                    </div>
                    <div className="text-4xl font-black text-white">{pendingFeedbackCount}</div>
                    <div className="text-[10px] text-red-400 font-bold mt-2 uppercase tracking-tighter">Acción requerida inmediata</div>
                </div>
            </div>

            {/* FEEDBACK MODULE */}
            <div className="mb-12 text-left">
                <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-4 text-slate-800">
                    <span className="bg-red-500 text-white p-1 rounded">1</span>
                    Feedback y Reportes de Usuarios
                </h2>
                <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden text-left">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="p-4 font-black tracking-wider text-[10px] uppercase text-slate-400 text-left">Tipo</th>
                                    <th className="p-4 font-black tracking-wider text-[10px] uppercase text-slate-400 text-left">Mensaje</th>
                                    <th className="p-4 font-black tracking-wider text-[10px] uppercase text-slate-400 text-left">Estado</th>
                                    <th className="p-4 font-black tracking-wider text-[10px] uppercase text-slate-400 text-left">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {feedbackData.map(f => (
                                    <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 text-left">
                                            {f.type === 'bug' && <span className="bg-red-50 text-red-600 px-2 py-1 text-[10px] font-black rounded uppercase">Bug</span>}
                                            {f.type === 'feature_request' && <span className="bg-orange-50 text-orange-600 px-2 py-1 text-[10px] font-black rounded uppercase">Mejora</span>}
                                            {f.type === 'review' && <span className="bg-blue-50 text-blue-600 px-2 py-1 text-[10px] font-black rounded uppercase">Review</span>}
                                        </td>
                                        <td className="p-4 max-w-sm text-left">
                                            <p className="font-bold text-slate-700 leading-tight">{f.message}</p>
                                            <p className="text-[9px] text-slate-400 mt-1 uppercase font-mono">{new Date(f.createdAt).toLocaleString()}</p>
                                        </td>
                                        <td className="p-4 text-left">
                                            {f.status === 'open' ? (
                                                <span className="text-red-500 font-black animate-pulse text-xs">PENDIENTE</span>
                                            ) : (
                                                <span className="text-slate-400 font-black text-xs uppercase">{f.status}</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-left">
                                            <form action={markFeedbackStatus} className="flex gap-2">
                                                <input type="hidden" name="id" value={f.id} />
                                                <button type="submit" name="status" value={f.status === 'open' ? 'resolved' : 'open'} className="bg-slate-100 text-slate-600 px-4 py-2 text-[10px] font-black hover:bg-slate-900 hover:text-white transition-all rounded-xl uppercase">
                                                    {f.status === 'open' ? 'Resolver' : 'Reabrir'}
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ROUTINES MODULE */}
            <div className="mb-12 text-left">
                <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-4 text-slate-800">
                    <span className="bg-orange-500 text-white p-1 rounded">2</span>
                    Moderación de Feed Público
                </h2>
                <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden text-left">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="p-4 font-black tracking-wider text-[10px] uppercase text-slate-400 text-left">Nombre / ID</th>
                                    <th className="p-4 font-black tracking-wider text-[10px] uppercase text-slate-400 text-left">Autor</th>
                                    <th className="p-4 font-black tracking-wider text-[10px] uppercase text-slate-400 text-left">Descripción</th>
                                    <th className="p-4 font-black tracking-wider text-[10px] uppercase text-slate-400 text-left">Estado</th>
                                    <th className="p-4 font-black tracking-wider text-[10px] uppercase text-slate-400 text-left">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {routinesData.map(r => (
                                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 text-left">
                                            <div className="font-black text-slate-900 truncate max-w-[200px]">{r.name}</div>
                                            <div className="text-[10px] font-mono text-slate-400">{r.id.split('-')[0]}...</div>
                                        </td>
                                        <td className="p-4 text-left">
                                            <div className="font-black text-slate-700">@{r.username || 'unknown'}</div>
                                            <div className="text-[10px] text-slate-400 font-mono truncate max-w-[100px]">{r.userId}</div>
                                        </td>
                                        <td className="p-4 text-left">
                                            <p className="text-xs text-slate-500 line-clamp-2 italic text-left">{r.description || '—'}</p>
                                        </td>
                                        <td className="p-4 text-left text-left">
                                            {r.isPublic ? (
                                                <span className="bg-green-100 text-green-700 px-2 py-1 text-[10px] font-black rounded uppercase">Público</span>
                                            ) : (
                                                <span className="bg-slate-100 text-slate-600 px-2 py-1 text-[10px] font-black rounded uppercase">Privado/Oculto</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-left text-left">
                                            <form action={async (formData) => {
                                                'use server';
                                                const adminId = await getAuthenticatedAdmin();
                                                if (!adminId) throw new Error('Unauthorized');
                                                const id = formData.get('id') as string;
                                                const action = formData.get('action') as string;
                                                if (action === 'toggle-public') {
                                                    await db.update(schema.routines).set({ isPublic: r.isPublic ? 0 : 1, updatedAt: new Date() }).where(eq(schema.routines.id, id));
                                                } else if (action === 'purge') {
                                                    await db.update(schema.routines).set({ deletedAt: new Date(), isPublic: 0 }).where(eq(schema.routines.id, id));
                                                }
                                                revalidatePath('/admin');
                                            }} className="flex gap-2">
                                                <input type="hidden" name="id" value={r.id} />
                                                <button type="submit" name="action" value="toggle-public" className={`flex items-center gap-2 p-2 px-3 border rounded-xl transition-all uppercase text-[10px] font-black ${r.isPublic ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                                                    {r.isPublic ? <EyeOff className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                                    {r.isPublic ? 'Bajar' : 'Mostrar'}
                                                </button>
                                                <button type="submit" name="action" value="purge" className="flex items-center gap-2 p-2 px-3 border border-red-100 text-red-500 hover:bg-red-50 rounded-xl transition-all uppercase text-[10px] font-black">
                                                    <Trash2 className="w-3.5 h-3.5" /> Purga
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                ))}
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

import { desc, eq, isNull, sql } from 'drizzle-orm';
import {
    Activity,
    Check,
    CheckCircle,
    Clock,
    EyeOff,
    Flame,
    Hash,
    LayoutDashboard,
    Shield,
    Smartphone,
    Trash2,
    Trophy,
    User,
    Users,
    Zap
} from 'lucide-react';
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

async function handleRoutineAction(formData: FormData) {
    'use server';
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

    const id = formData.get('id') as string;
    const action = formData.get('action') as string;
    const currentModerated = formData.get('currentModerated') === '1';
    const message = formData.get('message') as string;

    if (action === 'toggle-moderation') {
        const newStatus = currentModerated ? 0 : 1;
        await db.update(schema.routines)
            .set({
                isModerated: newStatus,
                moderationMessage: newStatus === 1 ? (message || 'Contenido ocultado por incumplir las normas de la comunidad.') : null,
                // If we moderate (hide), we also ensure isPublic is 0 for consistency
                ...(newStatus === 1 ? { isPublic: 0 } : {}),
                updatedAt: new Date()
            })
            .where(eq(schema.routines.id, id));
    } else if (action === 'purge') {
        await db.update(schema.routines)
            .set({
                deletedAt: new Date(),
                isPublic: 0,
                isModerated: 1,
                moderationMessage: 'Esta rutina ha sido eliminada permanentemente por un administrador.',
                updatedAt: new Date()
            })
            .where(eq(schema.routines.id, id));
    }
    revalidatePath('/admin');
}

export default async function AdminPanel() {
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) redirect('/');

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
            isModerated: schema.routines.isModerated,
            moderationMessage: schema.routines.moderationMessage,
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

    const totalUsers = Number(profilesData[0]?.count || 0);
    const totalInstalls = Number(installsData[0]?.count || 0);
    const pendingFeedbackCount = feedbackData.filter(f => f.status === 'open').length;

    // IronSocial metrics
    const totalKudosData = await db.select({ count: sql<number>`count(*)` }).from(schema.kudos);
    const totalActivityData = await db.select({ count: sql<number>`count(*)` }).from(schema.activityFeed);

    const totalKudos = Number(totalKudosData[0]?.count || 0);
    const totalActivity = Number(totalActivityData[0]?.count || 0);

    const topStreaks = await db.select({
        id: schema.userProfiles.id,
        username: schema.userProfiles.username,
        currentStreak: schema.userProfiles.currentStreak,
        highestStreak: schema.userProfiles.highestStreak
    }).from(schema.userProfiles)
        .where(sql`${schema.userProfiles.highestStreak} > 0`)
        .orderBy(desc(schema.userProfiles.highestStreak))
        .limit(5);

    const currentDate = new Date().toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <div className="min-h-screen bg-[#f5f1e8] text-[#1a1a2e] font-mono p-4 md:p-8 selection:bg-[#1a1a2e] selection:text-[#f5f1e8]">
            <header className="mb-12 border-b-2 border-[#1a1a2e] pb-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#1a1a2e] p-3 text-[#f5f1e8]">
                            <Shield className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="text-[10px] opacity-60 tracking-[0.2em] mb-1">[ TELEMETRÍA CENTRAL ]</div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase leading-none">ADMIN_X_ZERO</h1>
                            <p className="text-[10px] opacity-40 mt-2 font-bold tracking-wider flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-[#1a1a2e] animate-pulse"></span>
                                SYSTEM STATUS: ONLINE • {currentDate}
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* METRICS GRID - THERMAL STYLE */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border border-[#1a1a2e] bg-[#1a1a2e] mb-12 shadow-[8px_8px_0px_0px_rgba(26,26,46,0.1)]">
                <div className="bg-[#f5f1e8] p-6 border-r border-b border-[#1a1a2e] md:border-b-0 lg:border-b-0">
                    <div className="text-[10px] opacity-60 font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Smartphone className="w-3.5 h-3.5" /> INSTALACIONES
                    </div>
                    <div className="text-4xl font-black tracking-tighter">{totalInstalls}</div>
                    <div className="text-[9px] opacity-40 font-bold mt-2 uppercase tracking-wide">Device_UUID_Unique</div>
                </div>

                <div className="bg-[#f5f1e8] p-6 border-r border-b border-[#1a1a2e] md:border-b-0 lg:border-b-0">
                    <div className="text-[10px] opacity-60 font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Users className="w-3.5 h-3.5" /> CUENTAS_SYNC
                    </div>
                    <div className="text-4xl font-black tracking-tighter">{totalUsers}</div>
                    <div className="text-[9px] opacity-40 font-bold mt-2 uppercase tracking-wide">P2P_Encryption_Active</div>
                </div>

                <div className="bg-[#f5f1e8] p-6 border-r border-[#1a1a2e]">
                    <div className="text-[10px] opacity-60 font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5" /> PUBLIC_FEED
                    </div>
                    <div className="text-4xl font-black tracking-tighter">{routinesData.filter(r => r.isPublic === 1).length}</div>
                    <div className="text-[9px] opacity-40 font-bold mt-2 uppercase tracking-wide">Total_Indexed_Routines</div>
                </div>

                <div className="bg-[#1a1a2e] p-6 text-[#f5f1e8]">
                    <div className="text-[10px] opacity-50 font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                        <LayoutDashboard className="w-3.5 h-3.5 text-orange-400" /> PENDIENTE
                    </div>
                    <div className="text-4xl font-black tracking-tighter text-orange-400">{pendingFeedbackCount}</div>
                    <div className="text-[9px] text-orange-400/60 font-black mt-2 uppercase tracking-wide">Urgent_Action_Required</div>
                </div>
            </div>

            {/* SECCIÓN 02: SOCIAL */}
            <div className="mb-12">
                <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a2e]/10 pb-2">
                    <div className="bg-[#1a1a2e] text-[#f5f1e8] text-[10px] font-black px-2 py-0.5">02</div>
                    <h2 className="text-lg font-black uppercase tracking-tight">IRONSOCIAL_INTERACTIONS</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="border border-[#1a1a2e] p-6 bg-[#f5f1e8]/50">
                        <div className="text-[10px] opacity-60 font-black uppercase mb-4 flex items-center gap-2">
                            <Flame className="w-3.5 h-3.5" /> KUDOS_FIRED
                        </div>
                        <div className="text-4xl font-black tracking-tighter">{totalKudos}</div>
                        <div className="text-[9px] opacity-40 font-bold mt-2 uppercase">Global_Motivation_Counter</div>
                    </div>

                    <div className="border border-[#1a1a2e] p-6 bg-[#f5f1e8]/50">
                        <div className="text-[10px] opacity-60 font-black uppercase mb-4 flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5" /> ACTIVITY_OPS
                        </div>
                        <div className="text-4xl font-black tracking-tighter">{totalActivity}</div>
                        <div className="text-[9px] opacity-40 font-bold mt-2 uppercase">Live_Event_Log_Stream</div>
                    </div>

                    <div className="bg-[#1a1a2e] p-6 text-[#f5f1e8]">
                        <div className="text-[10px] opacity-50 font-black uppercase mb-4 flex items-center gap-2">
                            <Trophy className="w-3.5 h-3.5 text-orange-400" /> DISCIPLINA_LEADERBOARD
                        </div>
                        {topStreaks.length > 0 ? (
                            <div className="space-y-2 mt-2">
                                {topStreaks.map((athlete, i) => (
                                    <div key={athlete.id} className="flex items-center justify-between border-b border-[#f5f1e8]/10 pb-1">
                                        <span className="text-[11px] font-bold uppercase tracking-tight">#{i + 1} {athlete.username || 'ANON_USER'}</span>
                                        <span className="text-[11px] font-black text-orange-400 font-mono">STREAK_{athlete.highestStreak}D</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-[10px] opacity-30 italic">WAITING_FOR_DATA...</div>
                        )}
                    </div>
                </div>
            </div>

            {/* SECCIÓN 03: MODERACIÓN RUTINAS */}
            <div className="mb-12">
                <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a2e]/10 pb-2">
                    <div className="bg-[#1a1a2e] text-[#f5f1e8] text-[10px] font-black px-2 py-0.5">03</div>
                    <h2 className="text-lg font-black uppercase tracking-tight">PUBLIC_ROUTINES_MODERATION</h2>
                </div>

                <div className="border-2 border-[#1a1a2e] bg-[#f5f1e8] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                                <tr className="border-b-2 border-[#1a1a2e] bg-[#1a1a2e] text-[#f5f1e8]">
                                    <th className="p-4 font-black uppercase tracking-widest">IDENTIFIER</th>
                                    <th className="p-4 font-black uppercase tracking-widest">AUTHOR</th>
                                    <th className="p-4 font-black uppercase tracking-widest">VISIBILITY</th>
                                    <th className="p-4 font-black uppercase tracking-widest text-right">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1a1a2e]/10">
                                {routinesData.map(r => (
                                    <tr key={r.id} className="hover:bg-[#1a1a2e]/5 transition-colors group">
                                        <td className="p-4">
                                            <div className="font-black uppercase tracking-tighter text-sm mb-1">{r.name}</div>
                                            <div className="opacity-40 flex items-center gap-1 font-mono text-[9px]">
                                                <Hash className="w-2.5 h-2.5" /> {r.id}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-black text-[#1a1a2e] flex items-center gap-1">
                                                <User className="w-3 h-3 opacity-40" /> @{r.username || 'unknown_node'}
                                            </div>
                                            <div className="text-[9px] opacity-40 font-mono mt-1">{r.userId.slice(0, 16)}...</div>
                                        </td>
                                        <td className="p-4">
                                            {r.isPublic ? (
                                                <div className="inline-flex items-center gap-1.5 bg-[#1a1a2e] text-[#f5f1e8] px-2 py-0.5 font-black text-[9px] tracking-widest">
                                                    <Zap className="w-2.5 h-2.5" /> PÚBLICA
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-1.5 border border-[#1a1a2e] px-2 py-0.5 font-black text-[9px] tracking-widest opacity-40">
                                                    <Clock className="w-2.5 h-2.5" /> PRIVADA
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <form action={handleRoutineAction} className="inline-flex flex-col gap-2 items-end">
                                                <input type="hidden" name="id" value={r.id} />
                                                <input type="hidden" name="currentModerated" value={r.isModerated ? '1' : '0'} />

                                                {!r.isModerated && (
                                                    <input
                                                        type="text"
                                                        name="message"
                                                        placeholder="Motivo (opcional)..."
                                                        className="bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 px-2 py-1 text-[9px] w-32 focus:outline-none focus:border-[#1a1a2e]"
                                                    />
                                                )}

                                                {r.moderationMessage && (
                                                    <div className="text-[8px] text-amber-600 font-bold max-w-[120px] leading-tight mb-1 italic">
                                                        "{r.moderationMessage}"
                                                    </div>
                                                )}

                                                <div className="flex gap-2">
                                                    <button
                                                        type="submit"
                                                        name="action"
                                                        value="toggle-moderation"
                                                        className={`h-8 px-3 border border-[#1a1a2e] font-black uppercase text-[9px] transition-all flex items-center gap-2 ${r.isModerated ? 'bg-amber-400 hover:bg-[#1a1a2e] hover:text-[#f5f1e8]' : 'bg-[#f5f1e8] hover:bg-[#1a1a2e] hover:text-[#f5f1e8]'}`}
                                                        title={r.isModerated ? "Mostrar en feed" : "Ocultar en feed"}
                                                    >
                                                        {r.isModerated ? <CheckCircle className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                                        {r.isModerated ? 'HABILITAR' : 'OCULTAR'}
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        name="action"
                                                        value="purge"
                                                        className="h-8 px-3 bg-red-500 text-white font-black uppercase text-[9px] hover:bg-red-600 transition-all flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                                        title="Eliminar permanentemente"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> PURGA
                                                    </button>
                                                </div>
                                            </form>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 04: FEEDBACK */}
            <div className="mb-20">
                <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a2e]/10 pb-2">
                    <div className="bg-[#1a1a2e] text-[#f5f1e8] text-[10px] font-black px-2 py-0.5">04</div>
                    <h2 className="text-lg font-black uppercase tracking-tight">SYSTEM_REPORTS_FEEDBACK</h2>
                </div>

                <div className="border border-[#1a1a2e] bg-[#f5f1e8] shadow-[4px_4px_0px_0px_rgba(26,26,46,0.05)]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                                <tr className="border-b border-[#1a1a2e] bg-[#1a1a2e]/5">
                                    <th className="p-4 font-black uppercase tracking-widest opacity-60">TYPE</th>
                                    <th className="p-4 font-black uppercase tracking-widest opacity-60">CONTENT_LOG</th>
                                    <th className="p-4 font-black uppercase tracking-widest opacity-60">STATUS</th>
                                    <th className="p-4 font-black uppercase tracking-widest opacity-60 text-right">FLOW</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1a1a2e]/10">
                                {feedbackData.map(f => (
                                    <tr key={f.id} className="hover:bg-white transition-colors">
                                        <td className="p-4">
                                            <div className={`inline-block px-1.5 py-0.5 font-black text-[9px] uppercase tracking-tighter ${f.type === 'bug' ? 'bg-red-100 text-red-600' :
                                                f.type === 'feature_request' ? 'bg-orange-100 text-orange-600' :
                                                    'bg-blue-100 text-blue-600'
                                                }`}>
                                                {f.type}
                                            </div>
                                        </td>
                                        <td className="p-4 max-w-sm">
                                            <p className="font-bold leading-tight uppercase tracking-tight text-[#1a1a2e]">{f.message}</p>
                                            <div className="text-[9px] opacity-30 mt-2 font-mono flex items-center gap-1">
                                                <Clock className="w-2.5 h-2.5" /> {new Date(f.createdAt).toISOString()}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {f.status === 'open' ? (
                                                <div className="text-orange-500 font-black animate-pulse flex items-center gap-1">
                                                    <Activity className="w-3 h-3" /> PENDIENTE_X
                                                </div>
                                            ) : (
                                                <div className="text-[#1a1a2e] opacity-40 font-black flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> ARCHIVADO
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <form action={markFeedbackStatus}>
                                                <input type="hidden" name="id" value={f.id} />
                                                <input type="hidden" name="status" value={f.status === 'open' ? 'resolved' : 'open'} />
                                                <button type="submit" className="border border-[#1a1a2e] px-4 py-1 font-black text-[9px] hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all uppercase">
                                                    {f.status === 'open' ? '→ RESOLVER' : '→ REABRIR'}
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

            <footer className="mt-24 text-center pb-12 border-t border-[#1a1a2e] pt-12">
                <div className="text-[10px] opacity-40 font-bold tracking-[0.3em] uppercase mb-4">
                    IRONTRAIN CORE ● ENTERPRISE SECURITY & MODERATION
                </div>
                <div className="text-[9px] opacity-20 font-mono">
                    BUILD 2026.03.05_V2 ● POWERED_BY_MOTIONA_ZERO_TRUST
                </div>
            </footer>
        </div>
    );
}

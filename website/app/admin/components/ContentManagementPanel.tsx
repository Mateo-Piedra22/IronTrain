'use client';

import {
    History,
    Tag,
    Trash2,
    Zap
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
    handleChangelogAction,
    handleChangelogPublishAction,
    handleChangelogSyncAction,
    handleGlobalEventAction,
    handleGlobalEventDeriveAnnouncementAction
} from '../actions';
import ConfirmModal from './ConfirmModal';

type GlobalEventRow = {
    id: string;
    name: string;
    multiplier: number;
    startDate: string;
    endDate: string;
    isActive: boolean;
};

interface ContentManagementPanelProps {
    changelogs: any[];
    notifications: (any & { stats: { seen: number; clicked: number } })[];
    globalEvents: GlobalEventRow[];
    editingChangelog: any | null;
    editingNotification: any | null;
    editingGlobalEvent: GlobalEventRow | null;
    syncStatus: {
        lastSyncAt: string | null;
        totalInDb: number;
        syncStatus: string | null;
        upsertedCount: string | null;
        sourceCount: string | null;
        syncedAt: string | null;
    };
}

export default function ContentManagementPanel({
    changelogs,
    notifications,
    globalEvents,
    editingChangelog,
    editingNotification,
    editingGlobalEvent,
    syncStatus
}: ContentManagementPanelProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeSection = (searchParams.get('section') as 'broadcast' | 'changelog' | 'events') || 'broadcast';

    const [isPending, startTransition] = useTransition();
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    const setActiveSection = (section: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('section', section);
        router.push(`?${params.toString()}`, { scroll: false });
    };

    const handleConfirm = (title: string, message: string, action: () => void) => {
        setConfirmConfig({
            isOpen: true,
            title,
            message,
            onConfirm: action
        });
    };

    return (
        <div className="space-y-12">
            {/* Sync Status Overlay (Small strip) */}
            <div className={`flex flex-wrap items-center justify-between border-b-2 border-[#1a1a2e] pb-4 gap-4`}>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <History className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase">CHANGELOG_SYNC_STATUS:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[9px] border border-[#1a1a2e] px-2 py-0.5 font-bold uppercase tracking-wide bg-white">
                            LAST_DB_SYNC: {syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString('es-AR') : 'N/A'}
                        </span>
                        <span className="text-[9px] border border-[#1a1a2e] px-2 py-0.5 font-bold uppercase tracking-wide bg-white">
                            DB_VERSIONS: {syncStatus.totalInDb}
                        </span>
                    </div>
                </div>

                <form
                    action={handleChangelogSyncAction}
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleConfirm(
                            'RECONSTRUIR BASE DE DATOS',
                            'Esta acción reconstruirá el caché de changelogs. ¿Continuar?',
                            () => {
                                startTransition(async () => {
                                    await handleChangelogSyncAction();
                                });
                            }
                        );
                    }}
                >
                    <button
                        type="submit"
                        disabled={isPending}
                        className="h-9 px-4 bg-[#1a1a2e] text-[#f5f1e8] font-black uppercase text-[10px] tracking-wide hover:bg-orange-500 transition-colors flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_rgba(249,115,22,0.3)] disabled:opacity-50"
                    >
                        <Zap className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
                        {isPending ? 'PROCESANDO...' : 'FORZAR_DB_REBUILD'}
                    </button>
                </form>
            </div>

            {/* Quick Toggle for Section */}
            <div className="flex border-b border-[#1a1a2e]/10">
                <button
                    onClick={() => setActiveSection('broadcast')}
                    className={`px-8 py-3 font-black text-xs uppercase transition-all border-b-2 -mb-[1px] ${activeSection === 'broadcast' ? 'border-[#1a1a2e] text-[#1a1a2e]' : 'border-transparent text-[#1a1a2e]/40 hover:text-[#1a1a2e]'}`}
                >
                    NOTIFICACIONES_Y_ANUNCIOS
                </button>
                <button
                    onClick={() => setActiveSection('changelog')}
                    className={`px-8 py-3 font-black text-xs uppercase transition-all border-b-2 -mb-[1px] ${activeSection === 'changelog' ? 'border-[#1a1a2e] text-[#1a1a2e]' : 'border-transparent text-[#1a1a2e]/40 hover:text-[#1a1a2e]'}`}
                >
                    CONTROL_DE_VERSIONES_CHANGELOG
                </button>
                <button
                    onClick={() => setActiveSection('events')}
                    className={`px-8 py-3 font-black text-xs uppercase transition-all border-b-2 -mb-[1px] ${activeSection === 'events' ? 'border-[#1a1a2e] text-[#1a1a2e]' : 'border-transparent text-[#1a1a2e]/40 hover:text-[#1a1a2e]'}`}
                >
                    GLOBAL_EVENTS
                </button>
            </div>

            {activeSection === 'broadcast' ? (
                <div className="border-2 border-[#1a1a2e] bg-[#1a1a2e] text-[#f5f1e8] p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-4 mb-4">
                        <Zap className="w-8 h-8 text-yellow-400" />
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight">PostHog_Broadcast_Engine</h3>
                            <p className="text-[10px] font-bold opacity-60 uppercase">Notificaciones Migradas</p>
                        </div>
                    </div>
                    <p className="text-sm opacity-80 mb-6 leading-relaxed max-w-2xl">
                        El sistema de notificaciones y anuncios (Banners, Modales, Popups) ha sido migrado a <strong>PostHog Feature Flags y Surveys</strong>.
                        Ahora puedes lanzar anuncios de forma dinámica sin necesidad de desplegar código ni usar la base de datos transaccional.
                    </p>
                    <div className="flex gap-4">
                        <a
                            href="https://us.posthog.com/project/347728/feature_flags"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-yellow-400 text-[#1a1a2e] px-6 py-3 text-xs font-black uppercase hover:bg-yellow-300 transition-colors"
                        >
                            Feature Flags (Banners)
                        </a>
                        <a
                            href="https://us.posthog.com/project/347728/surveys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-white text-[#1a1a2e] px-6 py-3 text-xs font-black uppercase hover:bg-gray-200 transition-colors"
                        >
                            Surveys (Modales/Popups)
                        </a>
                    </div>
                </div>
            ) : activeSection === 'changelog' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 ">
                    {/* Management Form */}
                    <div className="border-2 border-[#1a1a2e] p-6 bg-[#f5f1e8] lg:sticky lg:top-8 h-fit">
                        <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a2e]/10 pb-2">
                            <Tag className="w-4 h-4" />
                            <h3 className="font-black text-xs uppercase">{editingChangelog ? 'EDIT_VERSION' : 'COMMIT_NEW_VERSION'}</h3>
                        </div>
                        <form action={handleChangelogAction} className="space-y-4">
                            <input type="hidden" name="id" value={editingChangelog?.id || ''} />
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Version_Semantic_Tag</label>
                                <input name="version" defaultValue={editingChangelog?.version || ''} placeholder="e.g. 1.2.0" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                            </div>
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Change_Manifest (Markdown OK)</label>
                                <textarea name="items" defaultValue={editingChangelog?.items?.join('\n') || ''} rows={10} placeholder="- Added X\n- Fixed Y" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                            </div>
                            <div className="flex items-center gap-2 bg-[#1a1a2e]/5 p-2">
                                <input type="checkbox" name="isUnreleased" value="true" id="unreleased_check" defaultChecked={editingChangelog?.isUnreleased === true} className="w-4 h-4 accent-[#1a1a2e]" />
                                <label htmlFor="unreleased_check" className="text-[10px] font-black uppercase">UNRELEASED_DRAFT_ONLY</label>
                            </div>
                            <button type="submit" name="intent" value="save" className="w-full bg-[#1a1a2e] text-green-400 py-3 font-black uppercase text-[10px] tracking-widest hover:bg-green-600 hover:text-[#1a1a2e] transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                                {editingChangelog ? 'UPDATE_RELEASE' : 'DEPLOY_VERSION_DATA'}
                            </button>
                            {editingChangelog && (
                                <Link
                                    href={`?tab=${searchParams.get('tab') || 'content'}&section=changelog`}
                                    className="block text-center text-[9px] font-black uppercase opacity-40 hover:opacity-100 mt-2 underline"
                                >
                                    CANCEL_OVERRIDE
                                </Link>
                            )}
                        </form>
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between mb-4 border-b border-[#1a1a2e]/10 pb-2">
                            <div className="text-[10px] font-black uppercase opacity-60">VERSION_REPOSITORY</div>
                            <div className="text-[10px] font-black uppercase opacity-60">{changelogs.length}_VERSIONS_TRACKED</div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {changelogs.map(c => (
                                <div key={c.id} className={`border border-[#1a1a2e] p-4 bg-white relative hover:translate-x-1 hover:translate-y-1 transition-all ${c.isUnreleased ? 'border-dashed border-orange-400 opacity-60' : ''}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-[#1a1a2e] text-[#f5f1e8] px-2 py-0.5 font-black text-xs">V{c.version}</div>
                                            {c.isUnreleased && <span className="text-[8px] font-black uppercase text-orange-600 bg-orange-100 px-1">DRAFT</span>}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {c.isUnreleased && (
                                                <form action={handleChangelogPublishAction}>
                                                    <input type="hidden" name="id" value={c.id} />
                                                    <button type="submit" className="text-[9px] font-black uppercase opacity-60 hover:opacity-100">
                                                        PUBLISH
                                                    </button>
                                                </form>
                                            )}
                                            <div className="flex items-center gap-1 bg-orange-500/10 px-1.5 py-0.5 rounded-sm border border-orange-500/10">
                                                <span className="text-[8px] font-black text-orange-600 mr-0.5">KUDOS</span>
                                                <span className="text-[10px] font-black text-orange-700">{c.reactionCount || 0}</span>
                                            </div>
                                            <Link
                                                href={`?tab=${searchParams.get('tab') || 'content'}&section=changelog&editChangelogId=${c.id}`}
                                                className="text-[10px] font-black uppercase hover:underline"
                                            >
                                                EDIT
                                            </Link>
                                            <form
                                                action={handleChangelogAction}
                                                onSubmit={(event) => {
                                                    event.preventDefault();
                                                    handleConfirm(
                                                        'ELIMINAR VERSIÓN',
                                                        `¿Eliminar permanentemente la versión ${c.version}?`,
                                                        () => {
                                                            startTransition(async () => {
                                                                const formData = new FormData(event.currentTarget as HTMLFormElement);
                                                                formData.set('intent', 'delete');
                                                                await handleChangelogAction(formData);
                                                            });
                                                        }
                                                    );
                                                }}
                                            >
                                                <input type="hidden" name="id" value={c.id} />
                                                <input type="hidden" name="origin_tab" value={searchParams.get('tab') || 'content'} />
                                                <input type="hidden" name="origin_section" value="changelog" />
                                                <button type="submit" name="intent" value="delete" className="text-red-500 hover:scale-110 transition-transform disabled:opacity-50" disabled={isPending}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        {c.items.slice(0, 3).map((item: string, idx: number) => (
                                            <div key={idx} className="text-[10px] opacity-60 line-clamp-1 truncate">{item}</div>
                                        ))}
                                        {c.items.length > 3 && <div className="text-[9px] font-black opacity-30 mt-1">+{c.items.length - 3} MORE_CHANGES</div>}
                                    </div>
                                    <div className="mt-4 flex items-center justify-between border-t border-[#1a1a2e]/5 pt-3">
                                        <div className="text-[8px] font-mono opacity-40 uppercase">COMMITTED: {new Date(c.updatedAt).toLocaleDateString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 ">
                    <div className="border-2 border-[#1a1a2e] p-6 bg-[#f5f1e8] lg:sticky lg:top-8 h-fit">
                        <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a2e]/10 pb-2">
                            <Zap className="w-4 h-4" />
                            <h3 className="font-black text-xs uppercase">{editingGlobalEvent ? 'EDIT_GLOBAL_EVENT' : 'NEW_GLOBAL_EVENT'}</h3>
                        </div>
                        <form action={handleGlobalEventAction} className="space-y-4">
                            <input type="hidden" name="id" value={editingGlobalEvent?.id || ''} />
                            <input type="hidden" name="origin_tab" value={searchParams.get('tab') || 'content'} />
                            <input type="hidden" name="origin_section" value="events" />
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Name</label>
                                <input name="name" defaultValue={editingGlobalEvent?.name || ''} placeholder="IRON_WEEK" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                            </div>
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Multiplier</label>
                                <input name="multiplier" defaultValue={editingGlobalEvent?.multiplier || 1} type="number" step="0.01" min="0.01" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Start</label>
                                    <input name="startDate" defaultValue={editingGlobalEvent?.startDate ? new Date(editingGlobalEvent.startDate).toISOString().slice(0, 16) : ''} type="datetime-local" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">End</label>
                                    <input name="endDate" defaultValue={editingGlobalEvent?.endDate ? new Date(editingGlobalEvent.endDate).toISOString().slice(0, 16) : ''} type="datetime-local" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-[#1a1a2e]/5 p-2 border border-[#1a1a2e]/10">
                                <input type="checkbox" name="isActive" value="true" id="event_active" defaultChecked={editingGlobalEvent ? editingGlobalEvent.isActive !== false : true} className="w-4 h-4 accent-[#1a1a2e]" />
                                <label htmlFor="event_active" className="text-[10px] font-black uppercase">ACTIVE</label>
                            </div>
                            <div className="flex items-center gap-2 bg-[#1a1a2e]/5 p-2 border border-[#1a1a2e]/10">
                                <input type="checkbox" name="sendPush" value="true" id="event_push" className="w-4 h-4 accent-[#1a1a2e]" />
                                <label htmlFor="event_push" className="text-[10px] font-black uppercase">SEND_PUSH_ON_ACTIVATE</label>
                            </div>
                            <button type="submit" className="w-full bg-[#1a1a2e] text-[#f5f1e8] py-3 font-black uppercase text-[10px] tracking-widest hover:bg-orange-500 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                                {editingGlobalEvent ? 'UPDATE_EVENT' : 'SAVE_EVENT'}
                            </button>
                            {editingGlobalEvent && (
                                <Link
                                    href={`?tab=${searchParams.get('tab') || 'content'}&section=events`}
                                    className="block text-center text-[9px] font-black uppercase opacity-40 hover:opacity-100 mt-2 underline"
                                >
                                    CANCEL_OVERRIDE
                                </Link>
                            )}
                        </form>
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between mb-4 border-b border-[#1a1a2e]/10 pb-2">
                            <div className="text-[10px] font-black uppercase opacity-60">EVENTS_REPOSITORY</div>
                            <div className="text-[10px] font-black uppercase opacity-60">{globalEvents.length}_EVENTS</div>
                        </div>

                        {globalEvents.map((e) => (
                            <div key={e.id} className={`border-2 border-[#1a1a2e] bg-white hover:shadow-[4px_4px_0px_0px_rgba(26,26,46,0.1)] transition-all ${e.isActive ? 'border-l-8 border-l-green-500' : 'opacity-60 border-l-8 border-l-red-500'}`}>
                                <div className="p-4 flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[8px] font-black uppercase px-1 py-0.5 bg-[#1a1a2e] text-[#f5f1e8]">
                                                x{Number(e.multiplier).toFixed(2)}
                                            </span>
                                            <div className="text-xs font-black uppercase tracking-tight">{e.name}</div>
                                        </div>
                                        <p className="text-[11px] leading-tight opacity-80 mb-3">
                                            {new Date(e.startDate).toLocaleString('es-AR')} → {new Date(e.endDate).toLocaleString('es-AR')}
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-2 min-w-[160px] justify-between border-t md:border-t-0 md:border-l border-[#1a1a2e]/5 md:pl-4 pt-4 md:pt-0">
                                        <form action={handleGlobalEventDeriveAnnouncementAction}>
                                            <input type="hidden" name="id" value={e.id} />
                                            <button type="submit" className="w-full bg-[#1a1a2e] text-[#f5f1e8] py-2 font-black uppercase text-[9px] tracking-widest hover:bg-orange-500 transition-colors">
                                                DERIVE_ANNOUNCEMENT
                                            </button>
                                        </form>
                                        <div className="flex items-center justify-end gap-3 pt-2">
                                            <Link
                                                href={`?tab=${searchParams.get('tab') || 'content'}&section=events&editEventId=${e.id}`}
                                                className="text-[10px] font-black uppercase hover:underline"
                                            >
                                                EDIT
                                            </Link>
                                            <form
                                                action={handleGlobalEventAction}
                                                onSubmit={(event) => {
                                                    event.preventDefault();
                                                    handleConfirm(
                                                        'ELIMINAR EVENTO',
                                                        `¿Eliminar el evento "${e.name}"?`,
                                                        () => {
                                                            startTransition(async () => {
                                                                const formData = new FormData(event.currentTarget as HTMLFormElement);
                                                                formData.set('intent', 'delete');
                                                                await handleGlobalEventAction(formData);
                                                            });
                                                        }
                                                    );
                                                }}
                                            >
                                                <input type="hidden" name="id" value={e.id} />
                                                <input type="hidden" name="origin_tab" value={searchParams.get('tab') || 'content'} />
                                                <input type="hidden" name="origin_section" value="events" />
                                                <button type="submit" name="intent" value="delete" className="text-red-500 hover:scale-110 transition-transform disabled:opacity-50" disabled={isPending}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
            />
        </div>
    );
}

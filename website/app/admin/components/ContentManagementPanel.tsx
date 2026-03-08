'use client';

import {
    Bell,
    History,
    Smartphone,
    Tag,
    Trash2,
    Zap
} from 'lucide-react';
import React from 'react';
import {
    handleChangelogAction,
    handleChangelogPublishAction,
    handleChangelogSyncAction,
    handleGlobalEventAction,
    handleGlobalEventDeriveAnnouncementAction,
    handleNotificationAction
} from '../actions';

type GlobalEventRow = {
    id: string;
    name: string;
    multiplier: number;
    startDate: string;
    endDate: string;
    isActive: number;
};

interface ContentManagementPanelProps {
    changelogs: any[];
    notifications: (any & { stats: { seen: number; clicked: number } })[];
    globalEvents: GlobalEventRow[];
    editingChangelog: any | null;
    editingNotification: any | null;
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
    syncStatus
}: ContentManagementPanelProps) {
    const [activeSection, setActiveSection] = React.useState<'broadcast' | 'changelog' | 'events'>('broadcast');

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

                <form action={handleChangelogSyncAction}>
                    <button type="submit" className="h-9 px-4 bg-[#1a1a2e] text-[#f5f1e8] font-black uppercase text-[10px] tracking-wide hover:bg-orange-500 transition-colors flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_rgba(249,115,22,0.3)]">
                        <Zap className="w-3.5 h-3.5" /> FORZAR_DB_REBUILD
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 ">
                    {/* Management Form */}
                    <div className="border-2 border-[#1a1a2e] p-6 bg-[#f5f1e8] lg:sticky lg:top-8 h-fit">
                        <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a2e]/10 pb-2">
                            <Bell className="w-4 h-4" />
                            <h3 className="font-black text-xs uppercase">{editingNotification ? 'EDIT_BROADCAST' : 'NEW_BROADCAST'}</h3>
                        </div>
                        <form action={handleNotificationAction} className="space-y-4">
                            <input type="hidden" name="id" value={editingNotification?.id || ''} />
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Title</label>
                                <input name="title" defaultValue={editingNotification?.title} placeholder="Announcement Title..." className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                            </div>
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Message</label>
                                <textarea name="message" defaultValue={editingNotification?.message} rows={3} placeholder="Content details..." className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Type</label>
                                    <select name="type" defaultValue={editingNotification?.type || 'toast'} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none">
                                        <option value="toast">Toast (Floating)</option>
                                        <option value="modal">Modal (Overlay)</option>
                                        <option value="system">System Only</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Mode</label>
                                    <select name="displayMode" defaultValue={editingNotification?.displayMode || 'once'} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none">
                                        <option value="once">Once</option>
                                        <option value="always">Always</option>
                                        <option value="until_closed">Until Closed</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Priority</label>
                                    <select name="priority" defaultValue={editingNotification?.priority || 'normal'} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none">
                                        <option value="low">Low</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Platform</label>
                                    <select name="targetPlatform" defaultValue={editingNotification?.targetPlatform || 'all'} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none">
                                        <option value="all">All</option>
                                        <option value="android">Android</option>
                                        <option value="ios">iOS</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Segment</label>
                                    <select name="targetSegment" defaultValue={editingNotification?.targetSegment || 'all'} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none">
                                        <option value="all">All Users</option>
                                        <option value="active">Active (7d)</option>
                                        <option value="inactive">Inactive (14d+)</option>
                                        <option value="new">New (7d)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Version_Lock</label>
                                    <input name="targetVersion" defaultValue={editingNotification?.targetVersion || ''} placeholder="e.g. 1.2.x" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Action URL (In-App Routing)</label>
                                <input name="actionUrl" defaultValue={editingNotification?.metadata ? JSON.parse(editingNotification.metadata).actionUrl : ''} placeholder="irontrain://changelog" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" />
                            </div>
                            <div className="flex items-center gap-2 bg-[#1a1a2e]/5 p-2 border border-[#1a1a2e]/10">
                                <input type="checkbox" name="isActive" value="true" id="active_notif" defaultChecked={editingNotification?.isActive !== 0} className="w-4 h-4 accent-[#1a1a2e]" />
                                <label htmlFor="active_notif" className="text-[10px] font-black uppercase">ENABLE_LIVE_FEED</label>
                            </div>
                            <button type="submit" name="action" value="save" className="w-full bg-[#1a1a2e] text-[#f5f1e8] py-3 font-black uppercase text-[10px] tracking-widest hover:bg-orange-500 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                                {editingNotification ? 'COMMIT_CHANGES' : 'PUBLISH_ANNOUNCEMENT'}
                            </button>
                            {editingNotification && (
                                <a href="/admin" className="block text-center text-[9px] font-black uppercase opacity-40 hover:opacity-100 mt-2 underline">CANCEL_OVERRIDE</a>
                            )}
                        </form>
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between mb-4 border-b border-[#1a1a2e]/10 pb-2">
                            <div className="text-[10px] font-black uppercase opacity-60">BROADCAST_HISTORY</div>
                            <div className="text-[10px] font-black uppercase opacity-60">SHOWING_{notifications.length}_SENT</div>
                        </div>
                        {notifications.map(n => {
                            const stats = n.stats;
                            return (
                                <div key={n.id} className={`border-2 border-[#1a1a2e] bg-white hover:shadow-[4px_4px_0px_0px_rgba(26,26,46,0.1)] transition-all ${n.isActive ? 'border-l-8 border-l-green-500' : 'opacity-60 border-l-8 border-l-red-500'}`}>
                                    <div className="p-4 flex flex-col md:flex-row gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[8px] font-black uppercase px-1 py-0.5 ${n.priority === 'critical' ? 'bg-red-600 text-white' :
                                                    n.priority === 'high' ? 'bg-orange-600 text-white' :
                                                        'bg-[#1a1a2e] text-[#f5f1e8]'
                                                    }`}>
                                                    {n.type}_{n.priority}
                                                </span>
                                                <div className="text-xs font-black uppercase tracking-tight">{n.title}</div>
                                            </div>
                                            <p className="text-[11px] leading-tight opacity-80 mb-3">{n.message}</p>
                                            <div className="flex flex-wrap gap-2">
                                                <div className="text-[9px] font-black uppercase opacity-40 bg-[#1a1a2e]/5 px-1.5 py-0.5 flex items-center gap-1">
                                                    <Smartphone size={8} /> {n.targetPlatform || 'all'}
                                                </div>
                                                <div className="text-[9px] font-black uppercase opacity-40 bg-[#1a1a2e]/5 px-1.5 py-0.5">
                                                    SEG: {n.targetSegment || 'all'}
                                                </div>
                                                {n.targetVersion && (
                                                    <div className="text-[9px] font-black uppercase opacity-40 bg-[#1a1a2e]/5 px-1.5 py-0.5">
                                                        VER: v{n.targetVersion}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 min-w-[120px] justify-between border-t md:border-t-0 md:border-l border-[#1a1a2e]/5 md:pl-4 pt-4 md:pt-0">
                                            <div className="grid grid-cols-2 gap-2 text-center">
                                                <div className="bg-[#1a1a2e]/5 p-1 border border-[#1a1a2e]/5">
                                                    <div className="text-[8px] opacity-40 font-black">SEEN</div>
                                                    <div className="text-xs font-black">{stats.seen}</div>
                                                </div>
                                                <div className="bg-[#1a1a2e]/5 p-1 border border-[#1a1a2e]/5">
                                                    <div className="text-[8px] opacity-40 font-black">CLCK</div>
                                                    <div className="text-xs font-black">{stats.clicked}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-end gap-3 pt-2">
                                                <a href={`?editNotifId=${n.id}`} className="text-[10px] font-black uppercase hover:underline">EDIT</a>
                                                <form action={handleNotificationAction}>
                                                    <input type="hidden" name="id" value={n.id} />
                                                    <button type="submit" name="action" value="delete" className="text-red-500">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
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
                                <input type="checkbox" name="isUnreleased" value="true" id="unreleased_check" defaultChecked={editingChangelog?.isUnreleased === 1} className="w-4 h-4 accent-[#1a1a2e]" />
                                <label htmlFor="unreleased_check" className="text-[10px] font-black uppercase">UNRELEASED_DRAFT_ONLY</label>
                            </div>
                            <button type="submit" name="action" value="save" className="w-full bg-[#1a1a2e] text-green-400 py-3 font-black uppercase text-[10px] tracking-widest hover:bg-green-600 hover:text-[#1a1a2e] transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                                {editingChangelog ? 'UPDATE_RELEASE' : 'DEPLOY_VERSION_DATA'}
                            </button>
                            {editingChangelog && (
                                <a href="/admin" className="block text-center text-[9px] font-black uppercase opacity-40 hover:opacity-100 mt-2 underline">DISCARD_EDIT</a>
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
                                            <a href={`?editChangelogId=${c.id}`} className="text-[9px] font-black uppercase opacity-40 hover:opacity-100">EDIT</a>
                                            <form action={handleChangelogAction}>
                                                <input type="hidden" name="id" value={c.id} />
                                                <button type="submit" name="action" value="delete" className="text-red-500">
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
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black">🔥 {c.kudos || 0}</span>
                                        </div>
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
                            <h3 className="font-black text-xs uppercase">NEW_GLOBAL_EVENT</h3>
                        </div>
                        <form action={handleGlobalEventAction} className="space-y-4">
                            <input type="hidden" name="id" value="" />
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Name</label>
                                <input name="name" placeholder="IRON_WEEK" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                            </div>
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Multiplier</label>
                                <input name="multiplier" defaultValue={1} type="number" step="0.01" min="0.01" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Start</label>
                                    <input name="startDate" type="datetime-local" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">End</label>
                                    <input name="endDate" type="datetime-local" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-[#1a1a2e]/5 p-2 border border-[#1a1a2e]/10">
                                <input type="checkbox" name="isActive" value="true" id="event_active" defaultChecked className="w-4 h-4 accent-[#1a1a2e]" />
                                <label htmlFor="event_active" className="text-[10px] font-black uppercase">ACTIVE</label>
                            </div>
                            <div className="flex items-center gap-2 bg-[#1a1a2e]/5 p-2 border border-[#1a1a2e]/10">
                                <input type="checkbox" name="sendPush" value="true" id="event_push" className="w-4 h-4 accent-[#1a1a2e]" />
                                <label htmlFor="event_push" className="text-[10px] font-black uppercase">SEND_PUSH_ON_ACTIVATE</label>
                            </div>
                            <button type="submit" className="w-full bg-[#1a1a2e] text-[#f5f1e8] py-3 font-black uppercase text-[10px] tracking-widest hover:bg-orange-500 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                                SAVE_EVENT
                            </button>
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
                                            <form action={handleGlobalEventAction}>
                                                <input type="hidden" name="id" value={e.id} />
                                                <button type="submit" name="action" value="delete" className="text-red-500">
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
        </div>
    );
}

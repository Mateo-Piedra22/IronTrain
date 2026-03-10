'use client';

import {
    Activity,
    Flame,
    Settings,
    Trash2,
    Trophy,
    Zap
} from 'lucide-react';
import { handleGlobalEventAction, handleScoringConfigAction } from '../actions';

interface IronSocialPanelProps {
    scoreConfig: any;
    globalEvents: any[];
    leaderboard: any[];
    breakdownByUser: Record<string, any[]>;
    recentEventsByUser: Record<string, any[]>;
}

export default function IronSocialPanel({
    scoreConfig,
    globalEvents,
    leaderboard,
    breakdownByUser,
    recentEventsByUser
}: IronSocialPanelProps) {
    return (
        <div className="space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Scoring Config */}
                <div className="border-2 border-[#1a1a2e] p-6 bg-[#f5f1e8]">
                    <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a2e]/10 pb-2">
                        <Settings className="w-4 h-4" />
                        <h3 className="font-black text-xs uppercase">SCORING_CORE_ENGINE</h3>
                    </div>
                    <form action={handleScoringConfigAction} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Workout_Complete</label>
                                <input type="number" name="workoutCompletePoints" defaultValue={scoreConfig.workoutCompletePoints} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1a1a2e]" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Extra_Day_Points</label>
                                <input type="number" name="extraDayPoints" defaultValue={scoreConfig.extraDayPoints} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1a1a2e]" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">PR_Normal</label>
                                <input type="number" name="prNormalPoints" defaultValue={scoreConfig.prNormalPoints} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1a1a2e]" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">PR_Big3 (SBD)</label>
                                <input type="number" name="prBig3Points" defaultValue={scoreConfig.prBig3Points} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1a1a2e]" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Weather_Cold_Def</label>
                                <input type="number" name="coldThresholdC" step="0.5" defaultValue={scoreConfig.coldThresholdC} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1a1a2e]" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Weather_Points</label>
                                <input type="number" name="adverseWeatherPoints" defaultValue={scoreConfig.adverseWeatherPoints} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1a1a2e]" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-[#1a1a2e]/5 p-3">
                            <input type="checkbox" name="weatherBonusEnabled" value="true" id="weather_on" defaultChecked={scoreConfig.weatherBonusEnabled === 1} className="w-4 h-4 accent-[#1a1a2e]" />
                            <label htmlFor="weather_on" className="text-[10px] font-black uppercase tracking-wider">Enable_Voluntad_De_Hierro</label>
                        </div>
                        <button type="submit" className="w-full bg-[#1a1a2e] text-[#f5f1e8] py-3 font-black uppercase text-[10px] tracking-widest hover:bg-orange-500 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                            SYNC_SCORING_V2
                        </button>
                    </form>
                </div>

                {/* Global Events */}
                <div className="border-2 border-[#1a1a2e] p-6 bg-[#f5f1e8]">
                    <div className="flex items-center justify-between mb-6 border-b border-[#1a1a2e]/10 pb-2">
                        <div className="flex items-center gap-3">
                            <Zap className="w-4 h-4" />
                            <h3 className="font-black text-xs uppercase">MULTI_GLOBAL_EVENTS</h3>
                        </div>
                    </div>

                    <form action={handleGlobalEventAction} className="space-y-4 mb-8 bg-white/50 p-4 border border-[#1a1a2e]/10">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Event_Name</label>
                                <input name="name" placeholder="Summer Event..." className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                            </div>
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Multiplier</label>
                                <input type="number" name="multiplier" step="0.1" defaultValue="1.5" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                            </div>
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Activation</label>
                                <select name="isActive" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none">
                                    <option value="true">DIRECT_ACTIVE</option>
                                    <option value="false">DRAFT_INACTIVE</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Start_Date</label>
                                <input type="datetime-local" name="startDate" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                            </div>
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">End_Date</label>
                                <input type="datetime-local" name="endDate" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <input type="checkbox" name="sendPush" value="true" id="push_event" className="w-4 h-4 accent-[#1a1a2e]" />
                            <label htmlFor="push_event" className="text-[10px] font-black uppercase tracking-wider">Broadcast_Push_To_All</label>
                        </div>
                        <button type="submit" className="w-full bg-orange-500 text-[#1a1a2e] py-3 font-black uppercase text-[10px] tracking-widest hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                            LAUNCH_EVENT
                        </button>
                    </form>

                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                        {globalEvents.map(event => (
                            <div key={event.id} className={`border border-[#1a1a2e] p-3 ${event.isActive ? 'bg-[#1a1a2e] text-[#f5f1e8]' : 'bg-white opacity-60'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="text-xs font-black uppercase">{event.name}</div>
                                        <div className="text-[10px] font-mono opacity-80">MULT: x{Number(event.multiplier).toFixed(2)}</div>
                                    </div>
                                    <form action={handleGlobalEventAction}>
                                        <input type="hidden" name="id" value={event.id} />
                                        <button type="submit" name="intent" value="delete" className="text-red-400 hover:text-red-600">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </form>
                                </div>
                                <div className="text-[9px] font-mono opacity-60">
                                    {new Date(event.startDate).toLocaleString('es-AR')} → {new Date(event.endDate).toLocaleString('es-AR')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* IronSocial Leaderboard Refactor */}
            <div className="border border-[#1a1a2e] p-6 bg-white overflow-hidden">
                <div className="flex items-center gap-3 mb-8 border-b border-[#1a1a2e]/10 pb-4">
                    <Trophy className="w-5 h-5" />
                    <h2 className="text-lg font-black uppercase tracking-tight">GLOBAL_COMMAND_LEADERBOARD</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {leaderboard.map(profile => {
                        const breakdown = breakdownByUser[profile.id] || [];
                        const recent = recentEventsByUser[profile.id] || [];
                        return (
                            <details key={profile.id} className="group border border-[#1a1a2e]/10 bg-[#f5f1e8]/30 hover:bg-[#f5f1e8] transition-colors">
                                <summary className="p-4 cursor-pointer list-none flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-[#1a1a2e] text-[#f5f1e8] flex items-center justify-center font-black text-xs">
                                            {profile.displayName?.slice(0, 2).toUpperCase() || '??'}
                                        </div>
                                        <div>
                                            <div className="text-xs font-black uppercase">@{profile.username || 'unknown'}</div>
                                            <div className="text-[10px] font-mono opacity-60">{profile.scoreLifetime} PTS</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {profile.currentStreak > 0 && (
                                            <div className="flex items-center gap-1 text-orange-600 font-black text-[10px]">
                                                <Flame className="w-3 h-3" /> {profile.currentStreak}
                                            </div>
                                        )}
                                        <Activity className="w-3 h-3 opacity-20 group-open:rotate-180 transition-transform" />
                                    </div>
                                </summary>
                                <div className="px-4 pb-4 space-y-4 border-t border-[#1a1a2e]/5 pt-4">
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        <div className="bg-white/50 p-2 border border-[#1a1a2e]/5">
                                            <div className="text-[8px] opacity-40 uppercase font-black">CURR_STREAK</div>
                                            <div className="text-xs font-black">{profile.currentStreak}W</div>
                                        </div>
                                        <div className="bg-white/50 p-2 border border-[#1a1a2e]/5">
                                            <div className="text-[8px] opacity-40 uppercase font-black">MAX_STREAK</div>
                                            <div className="text-xs font-black">{profile.highestStreak}W</div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="border border-[#1a1a2e]/10 p-3 bg-white/50">
                                            <div className="text-[10px] font-black uppercase mb-2 opacity-70">POINTS_BREAKDOWN</div>
                                            {breakdown.length === 0 ? (
                                                <div className="text-[10px] opacity-40 font-bold italic">SIN ACTIVIDAD</div>
                                            ) : (
                                                <div className="space-y-1">
                                                    {breakdown.map((item, idx) => (
                                                        <div key={idx} className="flex items-center justify-between text-[10px] font-black uppercase">
                                                            <span>{item.eventType}</span>
                                                            <span className="font-mono">+{item.points} ({item.count})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="border border-[#1a1a2e]/10 p-3 bg-white/50">
                                            <div className="text-[10px] font-black uppercase mb-2 opacity-70">RECENT_EVENTS</div>
                                            {recent.length === 0 ? (
                                                <div className="text-[10px] opacity-40 font-bold italic">SIN EVENTOS</div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {recent.map((event, idx) => (
                                                        <div key={idx} className="border-b border-[#1a1a2e]/5 last:border-0 pb-1 mb-1">
                                                            <div className="flex items-center justify-between text-[10px] font-black uppercase">
                                                                <span>{event.eventType}</span>
                                                                <span className="font-mono">+{event.pointsAwarded}</span>
                                                            </div>
                                                            <div className="text-[8px] opacity-40 font-mono italic">
                                                                {new Date(event.createdAt).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </details>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

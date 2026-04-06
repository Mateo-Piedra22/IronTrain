'use client';

import { resolveThemePreviewByMode, ThemeMode } from '@/lib/theme-marketplace/preview';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type ThemeModePreviewProps = {
    payload: Record<string, unknown>;
    supportsLight: boolean;
    supportsDark: boolean;
    compact?: boolean;
    initialMode?: ThemeMode;
    syncToQueryParam?: boolean;
    queryParamKey?: string;
    onModeChange?: (mode: ThemeMode) => void;
};

const TABS = ['INICIO', 'ENTRENO', 'PROGRESO'];

const getModeLabel = (mode: ThemeMode) => (mode === 'light' ? 'CLARO' : 'OSCURO');

export default function ThemeModePreview({
    payload,
    supportsLight,
    supportsDark,
    compact = false,
    initialMode,
    syncToQueryParam = false,
    queryParamKey = 'mode',
    onModeChange,
}: ThemeModePreviewProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const channelsByMode = useMemo(() => resolveThemePreviewByMode(payload), [payload]);

    const availableModes = useMemo(() => {
        const modes: ThemeMode[] = [];
        if (supportsLight) modes.push('light');
        if (supportsDark) modes.push('dark');
        return modes.length > 0 ? modes : (['light'] as ThemeMode[]);
    }, [supportsDark, supportsLight]);

    const [activeMode, setActiveMode] = useState<ThemeMode>(() => {
        if (initialMode && availableModes.includes(initialMode)) return initialMode;
        return availableModes[0];
    });

    useEffect(() => {
        if (availableModes.includes(activeMode)) return;
        setActiveMode(availableModes[0]);
    }, [activeMode, availableModes]);

    useEffect(() => {
        if (!initialMode) return;
        if (!availableModes.includes(initialMode)) return;
        setActiveMode(initialMode);
    }, [availableModes, initialMode]);

    useEffect(() => {
        if (!syncToQueryParam) return;

        const modeFromUrl = searchParams.get(queryParamKey);
        if (modeFromUrl !== 'light' && modeFromUrl !== 'dark') return;
        if (!availableModes.includes(modeFromUrl)) return;
        if (modeFromUrl === activeMode) return;

        setActiveMode(modeFromUrl);
    }, [activeMode, availableModes, queryParamKey, searchParams, syncToQueryParam]);

    useEffect(() => {
        onModeChange?.(activeMode);
    }, [activeMode, onModeChange]);

    useEffect(() => {
        if (!syncToQueryParam) return;

        const currentInUrl = searchParams.get(queryParamKey);
        if (currentInUrl === activeMode) return;

        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.set(queryParamKey, activeMode);
        const nextUrl = `${pathname}?${nextParams.toString()}`;
        router.replace(nextUrl, { scroll: false });
    }, [activeMode, pathname, queryParamKey, router, searchParams, syncToQueryParam]);

    const channels = channelsByMode[activeMode];
    const tabBarHeight = compact ? 'h-8' : 'h-10';
    const panelPadding = compact ? 'p-2' : 'p-3';

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
                <div className="text-[8px] font-black opacity-40 uppercase tracking-[0.25em]">MODE_PREVIEW</div>
                <div className="inline-flex border border-current/30">
                    {(['light', 'dark'] as ThemeMode[]).map((mode) => {
                        const disabled = !availableModes.includes(mode);
                        const selected = mode === activeMode;

                        return (
                            <button
                                key={mode}
                                type="button"
                                disabled={disabled}
                                onClick={() => setActiveMode(mode)}
                                className={`px-2 py-1 text-[8px] font-black uppercase tracking-[0.2em] transition-all ${selected
                                    ? 'bg-current text-background'
                                    : 'hover:bg-current/10'} ${disabled ? 'opacity-25 cursor-not-allowed' : ''}`}
                            >
                                {getModeLabel(mode)}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="border border-current/30 overflow-hidden" style={{ backgroundColor: channels.surface, color: channels.text }}>
                <div className={`border-b border-current/20 flex items-center ${tabBarHeight}`}>
                    {TABS.map((tab, index) => (
                        <div
                            key={tab}
                            className={`flex-1 flex items-center justify-center text-[8px] font-black uppercase tracking-[0.2em] ${index === 0 ? 'opacity-100' : 'opacity-55'}`}
                            style={index === 0 ? { backgroundColor: channels.hero, color: channels.surface } : undefined}
                        >
                            {tab}
                        </div>
                    ))}
                </div>

                <div className={`grid grid-cols-2 gap-2 ${panelPadding}`}>
                    <div className="border border-current/20 p-2">
                        <div className="text-[7px] font-black uppercase opacity-60 tracking-[0.2em] mb-1">CARD</div>
                        <div className="h-3" style={{ backgroundColor: channels.hero }} />
                    </div>
                    <div className="border border-current/20 p-2">
                        <div className="text-[7px] font-black uppercase opacity-60 tracking-[0.2em] mb-1">ACTION</div>
                        <div className="h-3 border border-current/30" style={{ backgroundColor: channels.surface }} />
                    </div>
                </div>

                <div className="border-t border-current/20 px-2 py-1 flex items-center justify-between text-[7px] font-black uppercase tracking-[0.2em] opacity-70">
                    <span>HOME</span>
                    <span>WORKOUT</span>
                    <span>PROFILE</span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <div className="h-8 border border-current/20" style={{ backgroundColor: channels.hero }} />
                <div className="h-8 border border-current/20" style={{ backgroundColor: channels.surface }} />
                <div className="h-8 border border-current/20" style={{ backgroundColor: channels.text }} />
            </div>
        </div>
    );
}

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
const NAV_ITEMS = ['HOME', 'WORKOUT', 'PROFILE'];

const getModeLabel = (mode: ThemeMode) => (mode === 'light' ? 'CLARO' : 'OSCURO');

const normalizeMode = (raw: string | null): ThemeMode | null => {
    if (raw === 'light' || raw === 'dark') return raw;
    return null;
};

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

        const modeFromUrl = normalizeMode(searchParams.get(queryParamKey));
        if (!modeFromUrl) return;
        if (!availableModes.includes(modeFromUrl)) return;
        if (modeFromUrl === activeMode) return;

        setActiveMode(modeFromUrl);
    }, [activeMode, availableModes, queryParamKey, searchParams, syncToQueryParam]);

    useEffect(() => {
        onModeChange?.(activeMode);
    }, [activeMode, onModeChange]);

    const handleModeSelect = (mode: ThemeMode) => {
        if (!availableModes.includes(mode)) return;
        if (mode === activeMode) return;

        setActiveMode(mode);

        if (!syncToQueryParam) return;
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.set(queryParamKey, mode);
        router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
    };

    const channels = channelsByMode[activeMode];
    const phoneWidth = compact ? 'max-w-[280px]' : 'max-w-[320px]';
    const heroBarHeight = compact ? 'h-2.5' : 'h-3';

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div className="text-[8px] font-black opacity-40 uppercase tracking-[0.25em]">MODE_PREVIEW</div>
                <div className="inline-flex border border-current/30 rounded-md overflow-hidden">
                    {(['light', 'dark'] as ThemeMode[]).map((mode) => {
                        const disabled = !availableModes.includes(mode);
                        const selected = mode === activeMode;
                        const modeChannels = channelsByMode[mode];

                        return (
                            <button
                                key={mode}
                                type="button"
                                disabled={disabled}
                                onClick={() => handleModeSelect(mode)}
                                className={`px-2 py-1 text-[8px] font-black uppercase tracking-[0.2em] transition-all ${selected
                                    ? ''
                                    : 'hover:bg-current/10'} ${disabled ? 'opacity-25 cursor-not-allowed' : ''}`}
                                style={selected ? { backgroundColor: modeChannels.surface, color: modeChannels.text } : undefined}
                            >
                                {getModeLabel(mode)}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className={`mx-auto w-full ${phoneWidth}`}>
                <div className="border border-current/30 overflow-hidden" style={{ backgroundColor: channels.surface, color: channels.text }}>
                    <div className="h-6 border-b border-current/20 px-2 flex items-center justify-between text-[7px] font-black uppercase tracking-[0.2em] opacity-60">
                        <span>09:41</span>
                        <span>IRONTRAIN</span>
                        <span>100%</span>
                    </div>

                    <div className="border-b border-current/20 h-10 flex items-center px-2 gap-2 text-[8px] font-black uppercase tracking-[0.2em]">
                        {TABS.map((tab, index) => (
                            <div
                                key={tab}
                                className="flex-1 h-6 flex items-center justify-center border border-current/20"
                                style={index === 0 ? { backgroundColor: channels.hero, color: channels.surface } : undefined}
                            >
                                {tab}
                            </div>
                        ))}
                    </div>

                    <div className="p-3 space-y-2 border-b border-current/20">
                        <div className="border border-current/20 p-2">
                            <div className="text-[7px] font-black uppercase tracking-[0.18em] opacity-60 mb-1">Resumen</div>
                            <div className="h-2 border border-current/20" style={{ backgroundColor: channels.hero }} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="border border-current/20 p-2">
                                <div className="text-[7px] font-black uppercase tracking-[0.18em] opacity-60 mb-1">Card</div>
                                <div className="h-2.5" style={{ backgroundColor: channels.hero }} />
                            </div>
                            <div className="border border-current/20 p-2">
                                <div className="text-[7px] font-black uppercase tracking-[0.18em] opacity-60 mb-1">Action</div>
                                <div className="h-2.5 border border-current/30" style={{ backgroundColor: channels.surface }} />
                            </div>
                        </div>

                        <div className={`${heroBarHeight} border border-current/20`} style={{ backgroundColor: channels.hero }} />
                        <div className={`${heroBarHeight} border border-current/20`} style={{ backgroundColor: channels.text }} />
                    </div>

                    <div className="h-10 border-t border-current/20 px-2 grid grid-cols-3 gap-2 text-[7px] font-black uppercase tracking-[0.2em] opacity-75">
                        {NAV_ITEMS.map((item, index) => (
                            <div
                                key={item}
                                className="flex items-center justify-center border border-current/20"
                                style={index === 0 ? { backgroundColor: channels.hero, color: channels.surface } : undefined}
                            >
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

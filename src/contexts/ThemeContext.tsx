import { Theme as NavTheme } from '@react-navigation/native';
import { StatusBarStyle } from 'expo-status-bar';
import React, { createContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { configService } from '../services/ConfigService';
import { dataEventService } from '../services/DataEventService';
import { _setGlobalActiveColors, resolveNavigationTheme, resolveThemeTokens, ThemeMode, ThemeTokens } from '../theme';
import { MAX_THEME_DRAFTS, resolveThemeTokensFromSelection, sanitizeThemeDraftList, ThemeColorPatch, ThemeDraft, validateThemeDraftInput } from '../theme-engine';
import { logger } from '../utils/logger';

export interface ThemeContextType {
    themeMode: ThemeMode;
    activeTheme: ThemeTokens;
    currentNavTheme: NavTheme;
    systemScheme: 'light' | 'dark';
    effectiveMode: 'light' | 'dark';
    themeDrafts: ThemeDraft[];
    activeThemePackIdLight: string | null;
    activeThemePackIdDark: string | null;
    setThemeMode: (mode: ThemeMode) => Promise<void>;
    setActiveThemePackId: (mode: 'light' | 'dark', themePackId: string | null) => Promise<void>;
    saveThemeDraft: (input: { id?: string; name: string; lightPatch: ThemeColorPatch; darkPatch: ThemeColorPatch }) => Promise<{ ok: true; draft: ThemeDraft } | { ok: false; errors: string[] }>;
    deleteThemeDraft: (id: string) => Promise<void>;
    statusBarStyle: StatusBarStyle;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const deviceScheme = useColorScheme() || 'light';
    const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(
        (Appearance.getColorScheme() as 'light' | 'dark') || 'light'
    );
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
    const [themeDrafts, setThemeDrafts] = useState<ThemeDraft[]>([]);
    const [activeThemePackIdLight, setActiveThemePackIdLight] = useState<string | null>(null);
    const [activeThemePackIdDark, setActiveThemePackIdDark] = useState<string | null>(null);

    // Load initial mode from config
    useEffect(() => {
        const loadInitialMode = async () => {
            try {
                await configService.init();
                const mode = configService.get('themeMode') as ThemeMode;
                if (mode) setThemeModeState(mode);
                const storedDrafts = sanitizeThemeDraftList(configService.get('themeDrafts'));
                setThemeDrafts(storedDrafts);

                const lightId = configService.get('activeThemePackIdLight');
                const darkId = configService.get('activeThemePackIdDark');
                setActiveThemePackIdLight(typeof lightId === 'string' && lightId.trim() ? lightId : null);
                setActiveThemePackIdDark(typeof darkId === 'string' && darkId.trim() ? darkId : null);
            } catch (error) {
                logger.error('Failed to load theme mode from config', { error });
            }
        };
        loadInitialMode();

        const unsub = dataEventService.subscribe('SETTINGS_UPDATED', (payload: any) => {
            if (payload?.key === 'themeMode') {
                setThemeModeState(payload.value as ThemeMode);
                return;
            }
            if (payload?.key === 'themeDrafts') {
                setThemeDrafts(sanitizeThemeDraftList(payload.value));
                return;
            }
            if (payload?.key === 'activeThemePackIdLight') {
                const value = payload?.value;
                setActiveThemePackIdLight(typeof value === 'string' && value.trim() ? value : null);
                return;
            }
            if (payload?.key === 'activeThemePackIdDark') {
                const value = payload?.value;
                setActiveThemePackIdDark(typeof value === 'string' && value.trim() ? value : null);
            }
        });

        return unsub;
    }, []);

    // Sync system scheme
    useEffect(() => {
        const sub = Appearance.addChangeListener(({ colorScheme }) => {
            if (colorScheme) {
                setSystemScheme(colorScheme as 'light' | 'dark');
            }
        });

        // Forced initial check
        const current = Appearance.getColorScheme();
        if (current && current !== systemScheme) {
            setSystemScheme(current as 'light' | 'dark');
        }

        return () => sub.remove();
    }, [systemScheme]);

    const effectiveMode = useMemo<'light' | 'dark'>(() => {
        if (themeMode === 'system') return systemScheme;
        return themeMode;
    }, [themeMode, systemScheme]);

    const sanitizedThemeDrafts = useMemo(() => sanitizeThemeDraftList(themeDrafts), [themeDrafts]);

    const activeTheme = useMemo(() => {
        const tokens = resolveThemeTokensFromSelection({
            mode: themeMode,
            activeSubthemeIdLight: activeThemePackIdLight,
            activeSubthemeIdDark: activeThemePackIdDark,
        }, systemScheme, sanitizedThemeDrafts) || resolveThemeTokens(themeMode, systemScheme);
        // Synchronize global Colors proxy for legacy/static usage
        _setGlobalActiveColors(tokens.colors);
        return tokens;
    }, [themeMode, systemScheme, activeThemePackIdLight, activeThemePackIdDark, sanitizedThemeDrafts]);

    const currentNavTheme = useMemo(() => resolveNavigationTheme(activeTheme), [activeTheme]);

    const setThemeMode = async (mode: ThemeMode) => {
        try {
            setThemeModeState(mode);
            await configService.set('themeMode', mode);
        } catch (error) {
            logger.error('Failed to save theme mode', { error, mode });
        }
    };

    const setActiveThemePackId = async (mode: 'light' | 'dark', themePackId: string | null) => {
        const normalized = typeof themePackId === 'string' && themePackId.trim() ? themePackId.trim() : null;
        const validated = normalized;

        if (mode === 'light') {
            setActiveThemePackIdLight(validated);
            await configService.set('activeThemePackIdLight', validated);
            return;
        }

        setActiveThemePackIdDark(validated);
        await configService.set('activeThemePackIdDark', validated);
    };

    const saveThemeDraft: ThemeContextType['saveThemeDraft'] = async (input) => {
        const validation = validateThemeDraftInput({
            name: input.name,
            lightPatch: input.lightPatch,
            darkPatch: input.darkPatch,
        });

        if (!validation.isValid) {
            return { ok: false, errors: validation.errors };
        }

        const now = Date.now();
        const existing = input.id ? sanitizedThemeDrafts.find((draft) => draft.id === input.id) : undefined;
        const nextDraft: ThemeDraft = {
            id: existing?.id ?? `theme_${now}_${Math.random().toString(36).slice(2, 8)}`,
            name: input.name.trim(),
            lightPatch: input.lightPatch,
            darkPatch: input.darkPatch,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };

        const nextDrafts = existing
            ? sanitizedThemeDrafts.map((draft) => (draft.id === existing.id ? nextDraft : draft))
            : [nextDraft, ...sanitizedThemeDrafts].slice(0, MAX_THEME_DRAFTS);

        setThemeDrafts(nextDrafts);
        await configService.set('themeDrafts', nextDrafts);

        return { ok: true, draft: nextDraft };
    };

    const deleteThemeDraft: ThemeContextType['deleteThemeDraft'] = async (id) => {
        const nextDrafts = sanitizedThemeDrafts.filter((draft) => draft.id !== id);
        const nextLight = activeThemePackIdLight === id ? null : activeThemePackIdLight;
        const nextDark = activeThemePackIdDark === id ? null : activeThemePackIdDark;

        setThemeDrafts(nextDrafts);
        setActiveThemePackIdLight(nextLight);
        setActiveThemePackIdDark(nextDark);

        await configService.set('themeDrafts', nextDrafts);
        if (nextLight !== activeThemePackIdLight) {
            await configService.set('activeThemePackIdLight', nextLight);
        }
        if (nextDark !== activeThemePackIdDark) {
            await configService.set('activeThemePackIdDark', nextDark);
        }
    };

    const statusBarStyle = useMemo((): StatusBarStyle => {
        // 'light' for dark background, 'dark' for light background (Expo Status Bar)
        return activeTheme.mode === 'dark' ? 'light' : 'dark';
    }, [activeTheme.mode]);

    const value = useMemo(() => ({
        themeMode,
        activeTheme,
        currentNavTheme,
        systemScheme,
        effectiveMode,
        themeDrafts: sanitizedThemeDrafts,
        activeThemePackIdLight,
        activeThemePackIdDark,
        setThemeMode,
        setActiveThemePackId,
        saveThemeDraft,
        deleteThemeDraft,
        statusBarStyle,
    }), [
        themeMode,
        activeTheme,
        currentNavTheme,
        systemScheme,
        effectiveMode,
        sanitizedThemeDrafts,
        activeThemePackIdLight,
        activeThemePackIdDark,
        statusBarStyle,
    ]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

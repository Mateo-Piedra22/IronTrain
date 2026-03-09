import { Theme as NavTheme } from '@react-navigation/native';
import { StatusBarStyle } from 'expo-status-bar';
import React, { createContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { configService } from '../services/ConfigService';
import { dataEventService } from '../services/DataEventService';
import { _setGlobalActiveColors, resolveNavigationTheme, resolveThemeTokens, ThemeMode, ThemeTokens } from '../theme';
import { logger } from '../utils/logger';

export interface ThemeContextType {
    themeMode: ThemeMode;
    activeTheme: ThemeTokens;
    currentNavTheme: NavTheme;
    systemScheme: 'light' | 'dark';
    setThemeMode: (mode: ThemeMode) => Promise<void>;
    statusBarStyle: StatusBarStyle;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const deviceScheme = useColorScheme() || 'light';
    const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(
        (Appearance.getColorScheme() as 'light' | 'dark') || 'light'
    );
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

    // Load initial mode from config
    useEffect(() => {
        const loadInitialMode = async () => {
            try {
                await configService.init();
                const mode = configService.get('themeMode') as ThemeMode;
                if (mode) setThemeModeState(mode);
            } catch (error) {
                logger.error('Failed to load theme mode from config', { error });
            }
        };
        loadInitialMode();

        const unsub = dataEventService.subscribe('SETTINGS_UPDATED', (payload: any) => {
            if (payload?.key === 'themeMode') {
                setThemeModeState(payload.value as ThemeMode);
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

    const activeTheme = useMemo(() => {
        const tokens = resolveThemeTokens(themeMode, systemScheme);
        // Synchronize global Colors proxy for legacy/static usage
        _setGlobalActiveColors(tokens.colors);
        return tokens;
    }, [themeMode, systemScheme]);

    const currentNavTheme = useMemo(() => resolveNavigationTheme(activeTheme), [activeTheme]);

    const setThemeMode = async (mode: ThemeMode) => {
        try {
            setThemeModeState(mode);
            await configService.set('themeMode', mode);
        } catch (error) {
            logger.error('Failed to save theme mode', { error, mode });
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
        setThemeMode,
        statusBarStyle,
    }), [themeMode, activeTheme, currentNavTheme, systemScheme, statusBarStyle]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

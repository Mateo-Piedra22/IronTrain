import { useContext } from 'react';
import { ThemeContext, ThemeContextType } from '../contexts/ThemeContext';
import { resolveNavigationTheme, resolveThemeTokens } from '../theme';

const fallbackTheme = resolveThemeTokens('light', 'light');

const FALLBACK_THEME_CONTEXT: ThemeContextType = {
    themeMode: 'light',
    activeTheme: fallbackTheme,
    currentNavTheme: resolveNavigationTheme(fallbackTheme),
    systemScheme: 'light',
    effectiveMode: 'light',
    themeDrafts: [],
    activeThemePackIdLight: null,
    activeThemePackIdDark: null,
    setThemeMode: async () => undefined,
    setActiveThemePackId: async () => undefined,
    saveThemeDraft: async () => ({ ok: false, errors: ['ThemeProvider unavailable'] }),
    deleteThemeDraft: async () => undefined,
    statusBarStyle: 'dark',
};

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (!context) {
        if (__DEV__) {
            console.warn('useTheme called outside ThemeProvider, using fallback theme context');
        }
        return FALLBACK_THEME_CONTEXT;
    }
    return context;
};

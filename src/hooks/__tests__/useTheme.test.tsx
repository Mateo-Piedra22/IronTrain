import { Theme } from '@react-navigation/native';
import { renderHook } from '@testing-library/react-native';
import React from 'react';
import { ThemeContext, ThemeContextType } from '../../contexts/ThemeContext';
import { resolveNavigationTheme, resolveThemeTokens } from '../../theme';
import { useTheme } from '../useTheme';

const makeContextValue = (mode: 'light' | 'dark' = 'dark'): ThemeContextType => {
    const activeTheme = resolveThemeTokens(mode, mode);
    return {
        themeMode: mode,
        activeTheme,
        currentNavTheme: resolveNavigationTheme(activeTheme) as Theme,
        systemScheme: mode,
        effectiveMode: mode,
        themeDrafts: [],
        activeThemePackIdLight: null,
        activeThemePackIdDark: null,
        setThemeMode: async () => undefined,
        setActiveThemePackId: async () => undefined,
        saveThemeDraft: async () => ({ ok: false, errors: ['not available'] }),
        deleteThemeDraft: async () => undefined,
        statusBarStyle: mode === 'dark' ? 'light' : 'dark',
    };
};

describe('useTheme', () => {
    it('returns ThemeContext value when used inside provider', () => {
        const mockThemeContext = makeContextValue('dark');

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <ThemeContext.Provider value={mockThemeContext}>
                {children}
            </ThemeContext.Provider>
        );

        const { result } = renderHook(() => useTheme(), { wrapper });

        expect(result.current).toBe(mockThemeContext);
        expect(result.current.effectiveMode).toBe('dark');
        expect(result.current.activeTheme.colors.background).toBeTruthy();
    });

    it('returns fallback theme context when used outside ThemeProvider', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        const { result } = renderHook(() => useTheme());

        expect(result.current).toBeDefined();
        expect(result.current.themeMode).toBe('light');
        expect(result.current.effectiveMode).toBe('light');
        expect(result.current.activeTheme.colors.background).toBeTruthy();

        warnSpy.mockRestore();
    });
});

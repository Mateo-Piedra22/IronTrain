import { renderHook } from '@testing-library/react-native';
import React from 'react';
import { ThemeContext, ThemeContextType } from '../../contexts/ThemeContext';
import { resolveNavigationTheme, resolveThemeTokens } from '../../theme';
import { useColors } from '../useColors';

describe('useColors', () => {
    it('returns active theme colors from ThemeContext', () => {
        const activeTheme = resolveThemeTokens('dark', 'dark');
        const contextValue: ThemeContextType = {
            themeMode: 'dark',
            activeTheme,
            currentNavTheme: resolveNavigationTheme(activeTheme),
            systemScheme: 'dark',
            effectiveMode: 'dark',
            themeDrafts: [],
            activeThemePackIdLight: null,
            activeThemePackIdDark: null,
            setThemeMode: async () => undefined,
            setActiveThemePackId: async () => undefined,
            saveThemeDraft: async () => ({ ok: false, errors: ['not available'] }),
            deleteThemeDraft: async () => undefined,
            statusBarStyle: 'light',
        };

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(ThemeContext.Provider, { value: contextValue }, children);

        const { result } = renderHook(() => useColors(), { wrapper });

        expect(result.current).toBe(activeTheme.colors);
        expect(result.current.background).toBe(activeTheme.colors.background);
        expect(result.current.primary.DEFAULT).toBe(activeTheme.colors.primary.DEFAULT);
    });
});

import { renderHook } from '@testing-library/react-native';
import React from 'react';
import { ThemeContext } from '../../contexts/ThemeContext';
import { useTheme } from '../useTheme';

describe('useTheme', () => {
    it('should return theme context when used within Provider', () => {
        const mockThemeContext = {
            theme: 'dark',
            setTheme: jest.fn(),
            activeTheme: { colors: {} },
            toggleTheme: jest.fn()
        };

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <ThemeContext.Provider value= { mockThemeContext as any } >
            { children }
            </ThemeContext.Provider>
        );

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current).toEqual(mockThemeContext);
});

it('should throw error when used outside of ThemeProvider', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current).toBeDefined();
    expect(result.current.activeTheme).toBeDefined();
    expect(result.current.themeMode).toBe('light');
    expect(result.current.effectiveMode).toBe('light');
});
});

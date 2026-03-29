import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { useTheme } from '../useTheme';
import { ThemeContext } from '../../contexts/ThemeContext';

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
    // Suppress console.error in output for expected throw
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    expect(() => renderHook(() => useTheme())).toThrow('useTheme must be used within a ThemeProvider');

    consoleSpy.mockRestore();
});
});
